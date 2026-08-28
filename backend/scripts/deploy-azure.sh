#!/usr/bin/env bash
#
# Deploy the backend to its Azure Function app, from a laptop.
#
# The infrastructure is Terraform's job (infra_azure/, applied by hand); this only
# ships code into the app that apply created. It reads the app's name from the
# Terraform outputs, so there is nothing to keep in sync by hand, and falls back to
# flags or environment variables when the state is somewhere else.
#
# What gets uploaded is *not* the working tree. The Function host wants a package
# whose root holds host.json, package.json and the runnable JavaScript, and cold
# start is charged per instance for every byte of it - so the zip is assembled in a
# staging directory from the esbuild bundle plus a production-only install
# (@azure/functions and nothing else, about 1.3 MB; see the "What gets deployed"
# section of README.md). The dev node_modules is left alone.
#
#   ./scripts/deploy-azure.sh                 # check, build, package, deploy, verify
#   ./scripts/deploy-azure.sh --skip-checks   # skip type-check and tests
#   ./scripts/deploy-azure.sh --package-only  # build the zip and stop
#
set -euo pipefail

readonly BACKEND_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly INFRA_DIR="$BACKEND_DIR/infra_azure"

app="${SDLB_FUNCTION_APP:-}"
resource_group="${SDLB_RESOURCE_GROUP:-}"
subscription="${SDLB_SUBSCRIPTION:-}"
skip_checks=0
package_only=0
keep_staging=0
zip_path=""

usage() {
  sed -n '3,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  cat <<'USAGE'

Options:
  -a, --app NAME              Function app name. Default: terraform output function_app_name.
  -g, --resource-group NAME   Resource group. Default: from Terraform, else looked up by app name.
  -s, --subscription ID       Azure subscription. Default: the one az is currently set to.
      --zip PATH              Where to write the package. Default: a temporary file.
      --skip-checks           Do not run type-check and tests before building.
      --package-only          Build the package and print its path; do not deploy.
      --keep                  Keep the staging directory and package after deploying.
  -h, --help                  This.

Environment: SDLB_FUNCTION_APP, SDLB_RESOURCE_GROUP, SDLB_SUBSCRIPTION do the same as
the first three flags. SDLB_SOURCEMAP=1 builds with source maps.
USAGE
}

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31merror: %s\033[0m\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--app)             app="${2:?--app needs a value}"; shift 2 ;;
    -g|--resource-group)  resource_group="${2:?--resource-group needs a value}"; shift 2 ;;
    -s|--subscription)    subscription="${2:?--subscription needs a value}"; shift 2 ;;
    --zip)                zip_path="${2:?--zip needs a value}"; shift 2 ;;
    --skip-checks)        skip_checks=1; shift ;;
    --package-only)       package_only=1; shift ;;
    --keep)               keep_staging=1; shift ;;
    -h|--help)            usage; exit 0 ;;
    *)                    usage >&2; die "unknown argument: $1" ;;
  esac
done

cd "$BACKEND_DIR"

# ------------------------------------------------------------------ prerequisites

for tool in yarn zip; do
  command -v "$tool" >/dev/null || die "$tool is not installed."
done
if (( ! package_only )); then
  command -v az >/dev/null || die "the Azure CLI is not installed - see https://aka.ms/azcli."
  for tool in curl jq; do
    command -v "$tool" >/dev/null || die "$tool is not installed."
  done
fi

# Terraform is only needed to *read* the outputs, so a missing binary or an
# uninitialised state directory is not fatal as long as the names are given.
terraform_output() {
  command -v terraform >/dev/null || return 1
  [[ -d "$INFRA_DIR/.terraform" ]] || return 1
  terraform -chdir="$INFRA_DIR" output -raw "$1" 2>/dev/null
}

# ---------------------------------------------------------------------- targeting

log 'Resolving the target'

if [[ -z "$app" ]]; then
  app="$(terraform_output function_app_name || true)"
  [[ -n "$app" ]] || die "could not read function_app_name from $INFRA_DIR - pass --app."
  info "app:            $app (terraform)"
else
  info "app:            $app"
fi

if (( ! package_only )); then
  az account show -o none 2>/dev/null || die "not signed in - run 'az login'."
  [[ -n "$subscription" ]] && az account set --subscription "$subscription"
  subscription="$(az account show --query id -o tsv)"
  info "subscription:   $(az account show --query name -o tsv) ($subscription)"

  if [[ -z "$resource_group" ]]; then
    # resource_group_name is an output only on newer applies; fall back to asking
    # Azure which group holds an app by that name.
    resource_group="$(terraform_output resource_group_name || true)"
    [[ -z "$resource_group" ]] && resource_group="$(
      az functionapp list --query "[?name=='$app'].resourceGroup | [0]" -o tsv 2>/dev/null || true
    )"
    [[ -n "$resource_group" ]] || die "could not find a function app named '$app' - pass --resource-group."
  fi
  info "resource group: $resource_group"

  read -r hostname scm_host < <(az functionapp show -g "$resource_group" -n "$app" --query \
    "[properties.defaultHostName, properties.hostNameSslStates[?hostType=='Repository'].name | [0]]" \
    -o tsv 2>/dev/null | paste -s || true)
  [[ -n "${hostname:-}" ]] || die "function app '$app' not found in resource group '$resource_group'."
  : "${scm_host:=${app}.scm.azurewebsites.net}"
  info "hostname:       $hostname"
fi

# -------------------------------------------------------------------------- build

log 'Installing'
yarn install --frozen-lockfile

if (( skip_checks )); then
  info 'checks skipped'
else
  log 'Type checking'
  yarn type-check
  log 'Testing'
  yarn test:ci
fi

log 'Building'
yarn build   # esbuild, via scripts/bundle.ts - dist/ is the whole artefact

# ------------------------------------------------------------------------ package

staging="$(mktemp -d -t sdlb-deploy-XXXXXX)"
[[ -n "$zip_path" ]] || zip_path="$staging.zip"
cleanup() {
  (( keep_staging )) && return
  rm -rf "$staging"
}
trap cleanup EXIT

log 'Packaging'

# host.json and package.json have to sit at the root of the zip: that is where the
# host looks for its configuration and for the "main" naming the entry point.
cp host.json package.json yarn.lock "$staging/"
cp -R dist "$staging/dist"

# The bundle inlines every dependency except @azure/functions, which stays external
# because it reaches for @azure/functions-core - something only the host provides.
# So a production install is that one package, and nothing devDependencies drags in.
( cd "$staging" && yarn install --production --frozen-lockfile --ignore-scripts --non-interactive >/dev/null )
rm -f "$staging/yarn.lock"

rm -f "$zip_path"
( cd "$staging" && zip -r -q -X "$zip_path" . )
info "package:        $zip_path ($(du -h "$zip_path" | cut -f1))"

if (( package_only )); then
  log 'Done - not deploying (--package-only)'
  keep_staging=1   # keep the zip; only the staging tree is disposable
  rm -rf "$staging"
  exit 0
fi

# ------------------------------------------------------------------------- deploy

log "Deploying to $app"

: "${scm_host:?}"

# The one-deploy API rather than `az functionapp deployment source config-zip`.
#
# They post the same package to the same endpoint, but the CLI command finishes by
# asking for a host key to poll the app with, and on this app that call fails: host
# keys live in the storage account, which has no shared key, so `az functionapp keys
# list` answers Bad Request. The upload has already succeeded by then - the command
# still exits non-zero, which is a bad thing for a deploy script to do. Calling the
# API directly gives a deployment id to poll instead, which needs no key at all.
#
# Basic publishing credentials are off in Terraform, so the only credential here is
# the Entra token az already holds. Kudu accepts an ARM-audience token; a 401 means
# the signed-in principal has no rights on the app, not that a password is missing.
#
# RemoteBuild=false: node_modules is in the package already, and a remote build
# would replace the trimmed production install with a full one.
token="$(az account get-access-token --resource https://management.core.windows.net/ \
  --query accessToken -o tsv)"
scm() { curl -fsS -H "Authorization: Bearer $token" "$@"; }

info "posting $(du -h "$zip_path" | cut -f1) to $scm_host"
deployment_id="$(
  scm -X POST \
    -H 'Content-Type: application/zip' \
    --data-binary "@$zip_path" \
    "https://$scm_host/api/publish?RemoteBuild=false&Deployer=deploy-azure.sh" \
  | tr -d '"'
)" || die "the upload was rejected. A 401 means the signed-in principal has no rights on $app."
info "deployment:     $deployment_id"

# 0 pending, 1 building, 2 deploying, 3 failed, 4 success.
status_url="https://$scm_host/api/deployments/$deployment_id"
for _ in $(seq 1 120); do
  deployment="$(scm "$status_url" || echo '{}')"
  [[ "$(jq -r '.complete // false' <<<"$deployment")" == 'true' ]] && break
  sleep 5
done

case "$(jq -r '.status // "?"' <<<"$deployment")" in
  4) info 'deployment:     succeeded' ;;
  *)
    scm "$status_url/log" | jq -r '.[] | "    \(.log_time)  \(.message)"' >&2 || true
    die "deployment $deployment_id did not succeed: $(jq -r '.status_text // .status' <<<"$deployment")"
    ;;
esac

# ------------------------------------------------------------------------- verify

log 'Verifying'

# The app can only read its own deployment container once the role assignment has
# propagated, and a cold start is 1.6-2.8 s on top of that, so the first few
# attempts failing is normal rather than a problem.
health="https://$hostname/health"
for attempt in $(seq 1 30); do
  status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$health" || echo 000)"
  if [[ "$status" == '200' ]]; then
    info "$health -> 200"
    log 'Deployed'
    info "API base URL:   $(terraform_output api_base_url || echo "https://$hostname/api/v1")"
    info "MCP base URL:   $(terraform_output mcp_base_url || echo "https://$hostname/mcp")"
    exit 0
  fi
  printf '    waiting for %s (%s) [%d/30]\r' "$health" "$status" "$attempt"
  sleep 5
done

printf '\n'
die "the app did not answer 200 on $health. Logs:
    az webapp log tail -g $resource_group -n $app
    az monitor app-insights query --apps ${app%-funcapp}-insights --analytics-query 'traces | order by timestamp desc | take 50'"
