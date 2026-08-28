#!/usr/bin/env bash
#
# Deploy the SPA to the Azure Static Web App, from a laptop.
#
# The counterpart of backend/scripts/deploy-azure.sh, and it reads the same
# Terraform state (backend/infra_azure/) - so the API URL baked into the deployed
# manifest is the one that apply actually produced, not one kept in sync by hand.
#
# Static content is served from the Static Web Apps edge. Nothing here routes
# through the Function app: the app is not attached as a linked backend, and the SPA
# calls the API at its own absolute URL. See the comment in infra_azure/static_site.tf.
#
#   yarn deploy-azure --databricks-client-id <id>
#   yarn deploy-azure --databricks-client-id <id> --repo my-repo --env prod
#   yarn deploy-azure --no-auth --package-only     # build it and stop, no OAuth app yet
#
set -euo pipefail

readonly ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly INFRA_DIR="$ROOT_DIR/backend/infra_azure"
readonly BUILD_DIR="$ROOT_DIR/build"
readonly CONFIG_TEMPLATE="$ROOT_DIR/scripts/staticwebapp.config.template.json"

# Pinned to a major: the CLI is the only supported way to push content to a Static
# Web App, and a surprise major would be a surprise in the deploy path.
readonly SWA_CLI_VERSION=2

site=""
resource_group="${SDLB_RESOURCE_GROUP:-}"
subscription="${SDLB_SUBSCRIPTION:-}"
client_id="${SDLB_DATABRICKS_CLIENT_ID:-}"
no_auth=0
scopes="${SDLB_DATABRICKS_SCOPES:-}"
repo=""
env_name=""
skip_checks=0
package_only=0

usage() {
  sed -n '3,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  cat <<'USAGE'

Options:
      --databricks-client-id ID  OAuth app the SPA signs in with. Required, because
                                 without it nobody can sign in to the deployed app.
      --no-auth                  Deploy anyway, with no way to sign in. For standing a
                                 site up before its OAuth app exists.
      --scopes "a b c"           OAuth scopes to request. Default: what the app asks for
                                 (see DEFAULT_SCOPES in src/auth/databricksOAuth.ts).
                                 They must also be assigned to the app connection.
      --repo NAME                Pin the deployment to one repository (flat routes, no
      --env NAME                 workspace switcher). Both or neither.
  -n, --name NAME                Static Web App name. Default: terraform output static_site_name.
  -g, --resource-group NAME      Default: from Terraform, else looked up by name.
  -s, --subscription ID          Default: the one az is currently set to.
      --skip-checks              Do not run type-check, lint and tests before building.
      --package-only             Build and prepare build/, but do not upload.
  -h, --help                     This.

Environment: SDLB_DATABRICKS_CLIENT_ID, SDLB_DATABRICKS_SCOPES, SDLB_RESOURCE_GROUP,
SDLB_SUBSCRIPTION.
USAGE
}

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[33m    warning: %s\033[0m\n' "$*"; }
die()  { printf '\n\033[31merror: %s\033[0m\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --databricks-client-id) client_id="${2:?needs a value}"; shift 2 ;;
    --no-auth)              no_auth=1; shift ;;
    --scopes)               scopes="${2:?needs a value}"; shift 2 ;;
    --repo)                 repo="${2:?needs a value}"; shift 2 ;;
    --env)                  env_name="${2:?needs a value}"; shift 2 ;;
    -n|--name)              site="${2:?needs a value}"; shift 2 ;;
    -g|--resource-group)    resource_group="${2:?needs a value}"; shift 2 ;;
    -s|--subscription)      subscription="${2:?needs a value}"; shift 2 ;;
    --skip-checks)          skip_checks=1; shift ;;
    --package-only)         package_only=1; shift ;;
    -h|--help)              usage; exit 0 ;;
    *)                      usage >&2; die "unknown argument: $1" ;;
  esac
done

[[ -n "$repo" && -z "$env_name" ]] && die "--repo needs --env as well."
[[ -n "$env_name" && -z "$repo" ]] && die "--env needs --repo as well."

# Checked here rather than where the manifest is written, which is on the far side of
# an install, a test run and a build: the answer is knowable now, and finding out
# five minutes later that the deployment cannot be signed in to is a waste of them.
if [[ -z "$client_id" ]] && (( ! no_auth )); then
  die "no --databricks-client-id.

    The app signs in with a Databricks OAuth app, and without its client id it sends
    no token - the backend runs with SDLB_AUTH_MODE=databricks and answers 401 to
    everything. Create one (see \"Deploying this app alongside it\" in README.md) and
    pass it here, or set SDLB_DATABRICKS_CLIENT_ID.

    --no-auth deploys without it, for standing a site up before its OAuth app exists."
fi

cd "$ROOT_DIR"

for tool in yarn jq curl npx; do
  command -v "$tool" >/dev/null || die "$tool is not installed."
done
(( package_only )) || command -v az >/dev/null || die "the Azure CLI is not installed - see https://aka.ms/azcli."

terraform_output() {
  command -v terraform >/dev/null || return 1
  [[ -d "$INFRA_DIR/.terraform" ]] || return 1
  terraform -chdir="$INFRA_DIR" output "$@" 2>/dev/null
}

# ---------------------------------------------------------------------- targeting

log 'Resolving the target'

api_base_url="$(terraform_output -raw api_base_url || true)"
[[ -n "$api_base_url" ]] || die "could not read api_base_url from $INFRA_DIR. Apply the Terraform first."
api_origin="$(sed -E 's#^(https?://[^/]+).*#\1#' <<<"$api_base_url")"
info "API:            $api_base_url"

# The browser posts the authorization code straight to the workspace's token
# endpoint, so those origins have to be in connect-src alongside the API.
databricks_hosts_json="$(terraform_output -json databricks_hosts || echo '[]')"
databricks_origins="$(jq -r 'join(" ")' <<<"$databricks_hosts_json")"
[[ -n "$databricks_origins" ]] || die "no databricks_hosts in the Terraform outputs."
info "workspaces:     $databricks_origins"

if (( ! package_only )); then
  az account show -o none 2>/dev/null || die "not signed in - run 'az login'."
  [[ -n "$subscription" ]] && az account set --subscription "$subscription"
  info "subscription:   $(az account show --query name -o tsv)"

  [[ -n "$site" ]] || site="$(terraform_output -raw static_site_name || true)"
  [[ -n "$site" ]] || die "could not read static_site_name from $INFRA_DIR - pass --name, or set create_static_site = true and apply."

  [[ -n "$resource_group" ]] || resource_group="$(terraform_output -raw resource_group_name || true)"
  [[ -n "$resource_group" ]] || resource_group="$(
    az staticwebapp list --query "[?name=='$site'].resourceGroup | [0]" -o tsv 2>/dev/null || true
  )"
  [[ -n "$resource_group" ]] || die "could not find a static web app named '$site' - pass --resource-group."

  site_url="$(az staticwebapp show -g "$resource_group" -n "$site" \
    --query "defaultHostname" -o tsv 2>/dev/null || true)"
  [[ -n "$site_url" ]] || die "static web app '$site' not found in resource group '$resource_group'."
  site_url="https://$site_url"
  info "site:           $site ($site_url)"
fi

# -------------------------------------------------------------------------- build

log 'Installing'
yarn install --frozen-lockfile

if (( skip_checks )); then
  info 'checks skipped'
else
  log 'Checking'
  # tsc has nothing to quieten - it reports errors, never warnings. eslint does: the
  # config sets rules with pre-existing violations to `warn` on purpose, so a clean
  # run still prints about 111 of them across 542 lines. --quiet drops those and
  # keeps errors, which is what `yarn lint` already fails on.
  yarn type-check
  yarn lint --quiet
  yarn test:ci
fi

log 'Building'
# --logLevel error: the build is otherwise a page of warnings nobody acts on - Node
# built-ins externalized for the browser (the HOCON parser reaches for fs and vm),
# a flow directive in react-virtualized, and the bundle size. Errors still print.
yarn build --logLevel error

# ------------------------------------------------------------------------ pruning

log 'Pruning the build'

# Vite copies all of public/ into build/, and public/ is where a developer keeps the
# HOCON, state files, schemas and descriptions they browse locally - most of it
# gitignored, all of it somebody's real project. In an `azure` deployment none of it
# is read: every one of those comes from the API. Publishing it would put a
# developer's working data on the open internet, so it goes before anything is
# uploaded rather than being trusted not to be requested.
#
# .github/workflows/build.yml drops the same directories from its artifact, minus
# state/, which simply never exists on a CI checkout.
for stale in config envConfig description schema state; do
  [[ -e "$BUILD_DIR/$stale" ]] && { rm -rf "${BUILD_DIR:?}/$stale"; info "removed build/$stale"; }
done
# Neither is served by anything: one configures a web server this deployment does
# not use, the other documents the source folder.
rm -f "$BUILD_DIR/lighttpd.conf" "$BUILD_DIR/README.md"

# ----------------------------------------------------------------------- manifest

log 'Writing the manifest'

# manifest.json is read once at startup and decides the backend, the routing shape
# and the identity provider, so the deployed copy has to say `azure` where the one
# in public/ says `local` - it is what makes local development work against files.
# Written here rather than committed so it cannot drift from what apply produced.
backend_config="azure;$api_base_url"
if [[ -n "$repo" ]]; then
  backend_config="$backend_config;$repo;$env_name"
  info "scope:          $repo/$env_name (single repository, flat routes)"
fi

manifest_filter='.backendConfig = $backend | .env = "prod"'
if [[ -n "$client_id" ]]; then
  manifest_filter="$manifest_filter | .auth = {type: \"databricks\", clientId: \$cid, workspaceHosts: \$hosts}"
  # Only when overridden: absent means the app uses its own default, so the two do
  # not have to be kept in step.
  if [[ -n "$scopes" ]]; then
    manifest_filter="$manifest_filter | .auth.scopes = \$scopes"
    info "scopes:         $scopes"
  fi
else
  warn '--no-auth: the deployed app has no way to sign in, and the backend runs with'
  warn 'SDLB_AUTH_MODE=databricks, so its API will answer 401 to every call.'
  manifest_filter="$manifest_filter | del(.auth)"
fi

jq --arg backend "$backend_config" \
   --arg cid "$client_id" \
   --arg scopes "$scopes" \
   --argjson hosts "$databricks_hosts_json" \
   "$manifest_filter" \
   "$ROOT_DIR/public/manifest.json" > "$BUILD_DIR/manifest.json"
info "backendConfig:  $backend_config"

# ------------------------------------------------------------- platform config

log 'Rendering staticwebapp.config.json'

# Headers and SPA fallback for the edge. The CSP is assembled here because two of
# its origins are only known after apply: the API, and the workspaces the browser
# reaches during sign-in.
sed -e "s#__API_ORIGIN__#$api_origin#" \
    -e "s#__DATABRICKS_ORIGINS__#$databricks_origins#" \
    "$CONFIG_TEMPLATE" > "$BUILD_DIR/staticwebapp.config.json"

# A surviving placeholder would ship a CSP that quietly blocks every API call, which
# looks like a broken backend rather than a broken header.
if grep -q '__[A-Z_]*__' "$BUILD_DIR/staticwebapp.config.json"; then
  die "unsubstituted placeholder in $BUILD_DIR/staticwebapp.config.json: $(grep -o '__[A-Z_]*__' "$BUILD_DIR/staticwebapp.config.json" | sort -u | tr '\n' ' ')"
fi
jq -e . "$BUILD_DIR/staticwebapp.config.json" >/dev/null || die 'the rendered config is not valid JSON.'
info "connect-src:    'self' $api_origin $databricks_origins"

if (( package_only )); then
  log "Done - not uploading (--package-only). The artefact is $BUILD_DIR"
  exit 0
fi

# ------------------------------------------------------------------------- upload

log "Deploying to $site"

# Through the environment rather than an argument, so it is not in the process list
# for every other user of the machine to read.
SWA_CLI_DEPLOYMENT_TOKEN="$(
  az staticwebapp secrets list -g "$resource_group" -n "$site" \
    --query "properties.apiKey" -o tsv
)"
export SWA_CLI_DEPLOYMENT_TOKEN
[[ -n "$SWA_CLI_DEPLOYMENT_TOKEN" ]] || die "could not read the deployment token for $site."

# --env production, because the CLI deploys to a preview environment by default and
# a preview is a second, publicly reachable hostname serving the same app.
npx -y "@azure/static-web-apps-cli@$SWA_CLI_VERSION" \
  deploy "$BUILD_DIR" \
  --env production \
  --swa-config-location "$BUILD_DIR" \
  --no-use-keychain

# ------------------------------------------------------------------------- verify

log 'Verifying'

for attempt in $(seq 1 20); do
  headers="$(curl -sS -D - -o /dev/null --max-time 20 "$site_url/" || true)"
  status="$(sed -n 's#^HTTP/[0-9.]* \([0-9]*\).*#\1#p' <<<"$headers" | tail -1)"
  if [[ "$status" == '200' ]]; then
    info "$site_url -> 200"
    grep -qi '^content-security-policy:' <<<"$headers" \
      && info 'CSP:            served' \
      || warn 'no Content-Security-Policy header - staticwebapp.config.json did not take effect.'

    # The API is on another origin, so every authenticated call - they all carry
    # Authorization and X-Databricks-Host, neither of them safelisted - is preceded
    # by a preflight. The Functions host answers OPTIONS itself, before the app runs,
    # so @fastify/cors never sees one and only the Terraform allowed_origins list can
    # satisfy it. Getting that wrong breaks the site in a way that looks nothing like
    # a CORS problem from here - the page loads, and every request fails - so it is
    # worth the one request it costs to check.
    preflight="$(curl -sS -D - -o /dev/null -X OPTIONS "$api_base_url/auth/token" \
      -H "Origin: $site_url" \
      -H 'Access-Control-Request-Method: POST' \
      -H 'Access-Control-Request-Headers: authorization,x-databricks-host,content-type' \
      --max-time 20 2>/dev/null || true)"
    if grep -qi "^access-control-allow-origin:.*$site_url" <<<"$preflight"; then
      info 'API preflight:  allowed'
    else
      warn "the API does not allow $site_url on a preflight, so every authenticated"
      warn 'call from the site will be blocked by the browser. Add the origin to'
      warn 'allowed_origins in the tfvars, apply, and restart the app - the host only'
      warn 'reads the CORS list at startup:'
      warn "  az functionapp restart -g <resource-group> -n <name>-funcapp"
    fi

    log 'Deployed'
    info "Open:           $site_url"
    exit 0
  fi
  printf '    waiting for %s (%s) [%d/20]\r' "$site_url" "${status:-000}" "$attempt"
  sleep 5
done

printf '\n'
die "the site did not answer 200 at $site_url."
