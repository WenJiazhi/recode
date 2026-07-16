#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
INSTALL_DIR=${RECODE_INSTALL_DIR:-"$HOME/.local/bin"}
BINARY_NAME=recode

if ! command -v bun >/dev/null 2>&1; then
  printf '%s\n' 'Bun is required. Install it from https://bun.sh and retry.' >&2
  exit 1
fi

cd "$REPO_ROOT"
bun install --frozen-lockfile
bun run build:binary

mkdir -p "$INSTALL_DIR"
install -m 755 "dist/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"

printf 'Installed Recode to %s\n' "$INSTALL_DIR/$BINARY_NAME"
printf 'Run: %s --version\n' "$INSTALL_DIR/$BINARY_NAME"
