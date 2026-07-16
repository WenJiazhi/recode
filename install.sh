#!/bin/sh

set -eu

REPOSITORY=${RECODE_REPOSITORY:-WenJiazhi/recode}
VERSION=${RECODE_VERSION:-latest}
INSTALL_DIR=${RECODE_INSTALL_DIR:-"$HOME/.local/bin"}

case "$(uname -s)" in
  Darwin) platform=darwin ;;
  Linux) platform=linux ;;
  *)
    printf '%s\n' 'This installer currently supports macOS and Linux.' >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  arm64|aarch64) arch=arm64 ;;
  x86_64|amd64) arch=x64 ;;
  *)
    printf 'Unsupported architecture: %s\n' "$(uname -m)" >&2
    exit 1
    ;;
esac

asset="recode-${platform}-${arch}.tar.gz"
if [ -n "${RECODE_DOWNLOAD_BASE_URL:-}" ]; then
  base_url=${RECODE_DOWNLOAD_BASE_URL%/}
elif [ "$VERSION" = latest ]; then
  base_url="https://github.com/${REPOSITORY}/releases/latest/download"
else
  base_url="https://github.com/${REPOSITORY}/releases/download/${VERSION}"
fi

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

if [ -n "${RECODE_ARCHIVE:-}" ]; then
  cp "$RECODE_ARCHIVE" "$tmp_dir/$asset"
else
  command -v curl >/dev/null 2>&1 || {
    printf '%s\n' 'curl is required to install Recode.' >&2
    exit 1
  }
  curl --fail --location --silent --show-error \
    "$base_url/$asset" --output "$tmp_dir/$asset"
  curl --fail --location --silent --show-error \
    "$base_url/checksums.txt" --output "$tmp_dir/checksums.txt"

  expected=$(awk -v file="$asset" '$2 == file { print $1 }' "$tmp_dir/checksums.txt")
  [ -n "$expected" ] || {
    printf 'No checksum found for %s\n' "$asset" >&2
    exit 1
  }

  if command -v shasum >/dev/null 2>&1; then
    actual=$(shasum -a 256 "$tmp_dir/$asset" | awk '{ print $1 }')
  elif command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$tmp_dir/$asset" | awk '{ print $1 }')
  else
    printf '%s\n' 'A SHA-256 utility is required to verify the download.' >&2
    exit 1
  fi

  [ "$actual" = "$expected" ] || {
    printf '%s\n' 'Checksum verification failed.' >&2
    exit 1
  }
fi

tar -xzf "$tmp_dir/$asset" -C "$tmp_dir"
[ -x "$tmp_dir/recode" ] || {
  printf '%s\n' 'The release archive does not contain a recode executable.' >&2
  exit 1
}
[ -x "$tmp_dir/recode-rg" ] || {
  printf '%s\n' 'The release archive does not contain the Recode ripgrep executable.' >&2
  exit 1
}

mkdir -p "$INSTALL_DIR"
install -m 755 "$tmp_dir/recode" "$INSTALL_DIR/recode"
install -m 755 "$tmp_dir/recode-rg" "$INSTALL_DIR/recode-rg"

printf 'Installed Recode to %s\n' "$INSTALL_DIR/recode"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) printf 'Run: recode --version\n' ;;
  *)
    printf 'Add %s to PATH, then run: recode --version\n' "$INSTALL_DIR"
    ;;
esac
