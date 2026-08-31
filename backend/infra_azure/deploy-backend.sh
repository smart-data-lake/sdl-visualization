#!/usr/bin/env bash
#
# Deploy the backend to its Azure Function app, from a laptop.
#
# The infrastructure is Terraform's job (this directory, applied by hand); this only
# ships code into the app that apply created. It reads the app's name from the
# Terraform outputs, so there is nothing to keep in sync by hand, and falls back to
# flags or environment variables when the state is somewhere else.
#
# It deploys a build; it does not make one. The bundle comes from ../dist when the
# working tree has been built, and otherwise from the artifact CI published - which
# is the same package, assembled by this same script in .github/workflows/build.yml.
# --build builds ../dist first, for the edit-and-deploy loop.
#
# What gets uploaded is *not* the working tree, and this script does not decide what
# is in it: `yarn package` (../scripts/package.ts) assembles the package, here and in
# CI alike, so the layout is defined in the backend rather than in the deployment.
# This zips what it produced and posts it.
#
#   ./deploy-backend.sh                   # ../dist if it exists, else the latest release
#   ./deploy-backend.sh --build           # build ../dist first, then deploy that
#   ./deploy-backend.sh --source develop  # deploy the develop snapshot
#   ./deploy-backend.sh --package-only    # assemble the package and stop
#
set -euo pipefail

readonly INFRA_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly BACKEND_DIR="$(cd -- "$INFRA_DIR/.." && pwd)"

app="${SDLB_FUNCTION_APP:-}"
resource_group="${SDLB_RESOURCE_GROUP:-}"
subscription="${SDLB_SUBSCRIPTION:-}"
source_kind='auto'
artifact_path=''
do_build=0
package_only=0
keep_staging=0
staging=''
zip_path=''

usage() {
  sed -n '3,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  cat <<'USAGE'

Options:
  -a, --app NAME              Function app name. Default: terraform output function_app_name.
  -g, --resource-group NAME   Resource group. Default: from Terraform, else looked up by app name.
  -s, --subscription ID       Azure subscription. Default: the one az is currently set to.
      --source WHERE          Where the build comes from: auto (default - local if ../dist
                              exists, else release), local, release, develop.
      --artifact PATH         Deploy this package instead: a zip, or a directory holding
                              host.json, package.json and dist/.
      --build                 Run `yarn build` in ../ first. Implies --source local.
      --stage-dir PATH        Where to assemble the package. Default: a temporary directory.
      --zip PATH              Where to write the package. Default: a temporary file.
      --package-only          Assemble the package and print its path; do not deploy.
                              Needs no Azure credentials and no Terraform state.
      --keep                  Keep the staging directory and package after deploying.
  -h, --help                  This.

Environment: SDLB_FUNCTION_APP, SDLB_RESOURCE_GROUP, SDLB_SUBSCRIPTION do the same as
the first three flags. SDLB_SOURCEMAP=1 makes --build emit source maps.
USAGE
}

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31merror: %s\033[0m\n' "$*" >&2; exit 1; }

# shellcheck source=artifact.sh
. "$INFRA_DIR/artifact.sh"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--app)             app="${2:?--app needs a value}"; shift 2 ;;
    -g|--resource-group)  resource_group="${2:?--resource-group needs a value}"; shift 2 ;;
    -s|--subscription)    subscription="${2:?--subscription needs a value}"; shift 2 ;;
    --source)             source_kind="${2:?--source needs a value}"; shift 2 ;;
    --artifact)           artifact_path="${2:?--artifact needs a value}"; shift 2 ;;
    --build)              do_build=1; shift ;;
    --stage-dir)          staging="${2:?--stage-dir needs a value}"; shift 2 ;;
    --zip)                zip_path="${2:?--zip needs a value}"; shift 2 ;;
    --package-only)       package_only=1; shift ;;
    --keep)               keep_staging=1; shift ;;
    -h|--help)            usage; exit 0 ;;
    *)                    usage >&2; die "unknown argument: $1" ;;
  esac
done

(( do_build )) && source_kind='local'
[[ -n "$artifact_path" ]] && source_kind='artifact'

case "$source_kind" in
  auto|local|release|develop|artifact) ;;
  *) die "unknown --source: $source_kind (auto, local, release or develop)." ;;
esac

cd "$BACKEND_DIR"

# ------------------------------------------------------------------ prerequisites

# zip in every path: the package is always re-zipped from the staging directory, so
# that what is posted is what was checked. unzip only where something is unpacked.
command -v zip >/dev/null || die "zip is not installed."
if [[ "$source_kind" != local ]]; then
  command -v unzip >/dev/null || die "unzip is not installed."
fi
if [[ "$source_kind" == local || "$source_kind" == auto ]]; then
  command -v yarn >/dev/null || die "yarn is not installed."
fi
if [[ "$source_kind" == release || "$source_kind" == develop || "$source_kind" == auto ]]; then
  command -v curl >/dev/null || die "curl is not installed."
fi
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

# Skipped entirely for --package-only: that is the CI path, where there is neither a
# Terraform state to read a name out of nor an Azure session to look one up with.
if (( ! package_only )); then
  log 'Resolving the target'

  if [[ -z "$app" ]]; then
    app="$(terraform_output function_app_name || true)"
    [[ -n "$app" ]] || die "could not read function_app_name from $INFRA_DIR - pass --app."
    info "app:            $app (terraform)"
  else
    info "app:            $app"
  fi

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

if (( do_build )); then
  log 'Building'
  yarn install --frozen-lockfile
  yarn build   # esbuild, via scripts/bundle.ts - dist/ is the whole artefact
fi

if [[ "$source_kind" == auto ]]; then
  if [[ -f "$BACKEND_DIR/dist/http.js" ]]; then
    source_kind='local'
  else
    source_kind='release'
  fi
fi

# ------------------------------------------------------------------------ staging

if [[ -n "$staging" ]]; then
  mkdir -p "$staging"
  staging="$(cd -- "$staging" && pwd)"
  # An explicit staging directory is asked for by name, so it is emptied rather than
  # merged into: leftovers from a previous run would ship in the zip.
  rm -rf -- "${staging:?}"/* "${staging:?}"/.[!.]*  2>/dev/null || true
  keep_staging=1
else
  staging="$(mktemp -d -t sdlb-deploy-XXXXXX)"
fi
[[ -n "$zip_path" ]] || zip_path="$staging.zip"

cleanup() {
  (( keep_staging )) && return
  rm -rf "$staging"
}
trap cleanup EXIT

log 'Assembling the package'
info "source:         $source_kind"

case "$source_kind" in
  local)
    [[ -f "$BACKEND_DIR/dist/http.js" ]] || die \
"there is no build in $BACKEND_DIR/dist.

    Run 'yarn build' in $BACKEND_DIR (or pass --build), or deploy a published
    build with --source release / --source develop."
    [[ -d "$BACKEND_DIR/node_modules" ]] || die \
"$BACKEND_DIR/node_modules is missing, so the packaging script cannot run.

    Run 'yarn install' in $BACKEND_DIR."
    info "bundle:         $BACKEND_DIR/dist"

    # scripts/package.ts, not a copy of it here. It knows the layout the Functions
    # host expects and which dependencies are production ones; keeping that in the
    # backend is what makes this package and the one build.yml publishes the same.
    # --no-build because dist/ is what was just checked for, or just built above.
    # --silent drops yarn's own three lines; sed puts what the script does print into
    # this script's column. pipefail is on, so a failure here still fails.
    yarn --silent package --no-build --out "$staging" | sed 's/^/    /'
    ;;

  artifact)
    [[ -e "$artifact_path" ]] || die "--artifact $artifact_path does not exist."
    if [[ -d "$artifact_path" ]]; then
      info "package:        $artifact_path (directory)"
      cp -R "$artifact_path/." "$staging/"
    else
      info "package:        $artifact_path"
      unzip -q "$artifact_path" -d "$staging"
    fi
    ;;

  release|develop)
    # The published artifact *is* the assembled package - build.yml uploads what
    # `yarn package` produced - so it only has to be unpacked, not rebuilt.
    downloaded="$staging.download.zip"
    fetch_artifact "$BACKEND_ARTIFACT" "$source_kind" "$downloaded"
    unzip -q "$downloaded" -d "$staging"
    rm -f "$downloaded"
    ;;
esac

# A package missing any of these deploys successfully and then answers 500 to
# everything, or registers no routes at all - both of which look like an
# infrastructure problem from the outside. Cheaper to find out here.
for required in host.json package.json dist/http.js node_modules/@azure/functions/package.json; do
  [[ -e "$staging/$required" ]] || die "the assembled package has no $required - it is not deployable."
done

rm -f "$zip_path"
( cd "$staging" && zip -r -q -X "$zip_path" . )
info "package:        $zip_path ($(du -h "$zip_path" | cut -f1))"

if (( package_only )); then
  log 'Done - not deploying (--package-only)'
  info "staging:        $staging"
  keep_staging=1
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
    "https://$scm_host/api/publish?RemoteBuild=false&Deployer=deploy-backend.sh" \
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
