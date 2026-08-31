# shellcheck shell=bash
#
# Where a build comes from when the working tree has not produced one.
#
# Sourced by deploy-backend.sh and deploy-frontend.sh. Both of them deploy a build
# rather than making one, so both need the same answer to "which build?" - and the
# names below are the artifact names in .github/workflows/build.yml. A release asset
# and a nightly link are both named after the artifact that produced them, so those
# three names move together or not at all.
#
# The two sources:
#
#   release   the asset of the newest *published* release. Drafts are not served by
#             /releases/latest/download, so a release the workflow created and nobody
#             published yet answers 404.
#   develop   nightly.link, which redirects to the artifact of the newest successful
#             `build` run on develop. GitHub's own artifact download needs a token;
#             nightly.link exists to hand out the same bytes without one. Artifacts
#             expire (90 days by default), so an idle branch eventually 404s too.
#
# Expects log()/info()/die() to already be defined - it is sourced after them.

readonly ARTIFACT_REPO='smart-data-lake/sdl-visualization'
readonly FRONTEND_ARTIFACT='sdl-visualizer'
readonly BACKEND_ARTIFACT='sdl-visualizer-backend'

# artifact_url <artifact-name> <release|develop>
artifact_url() {
  case "$2" in
    release) printf 'https://github.com/%s/releases/latest/download/%s.zip' "$ARTIFACT_REPO" "$1" ;;
    develop) printf 'https://nightly.link/%s/workflows/build/develop/%s.zip' "$ARTIFACT_REPO" "$1" ;;
    *)       return 1 ;;
  esac
}

# fetch_artifact <artifact-name> <release|develop> <destination-zip>
fetch_artifact() {
  local name="$1" channel="$2" out="$3" url
  url="$(artifact_url "$name" "$channel")" || die "unknown --source: $channel (auto, local, release or develop)."

  info "downloading:    $url"
  # A progress bar only where there is somebody watching it; in a log it is a single
  # 4 kB line of hashes.
  local progress=(--progress-bar)
  [[ -t 2 ]] || progress=(-sS)

  # -L because both URLs are redirects to storage, and --fail so a 404 is an error
  # here rather than an HTML error page unzipped as if it were a build.
  curl -fL --retry 3 --retry-delay 2 "${progress[@]}" -o "$out" "$url" || die \
"could not download $name.zip from the $channel source.

    $url

    A 404 on 'release' usually means the newest release is still a draft - the
    workflow creates them that way - so publish it, or use --source develop.
    A 404 on 'develop' means no successful build run on develop still has its
    artifact (they expire). Build locally instead: --build."

  # An HTML or JSON body saved with a .zip name is the failure that looks most like
  # success, so the file is checked before anything is unpacked from it.
  unzip -tqq "$out" >/dev/null 2>&1 || die "what was downloaded from $url is not a zip file."
  info "downloaded:     $(du -h "$out" | cut -f1)"
}
