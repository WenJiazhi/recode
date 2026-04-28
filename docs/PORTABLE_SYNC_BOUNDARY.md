# Portable Sync Boundary

Normal portable sync is source-first, not dependency-first.

## Default sync

The standard sync flow uses:

- `scripts/sync-portable.ps1`
- `sync-portable.bat`

By default it mirrors only:

- `src/`
- `packages/`
- `scripts/`
- `docs/`
- `.recode/` except local secrets
- selected top-level project files such as `package.json`, `bun.lock`, launchers, config files, and README files

By default it preserves:

- `runtime/`
- `node_modules/`
- `.recode/api-key.txt`
- `.recode/local-provider.json`
- `AGENTS.md`

## Dependency refresh

`runtime/` and `node_modules/` are refreshed only when `-RefreshDependencies` is explicitly used.

When using `-RefreshDependencies`, `PortableTemplateRoot` must point to a
materialized portable template. Junctions/reparse points inside `runtime/` or
`node_modules/` are rejected instead of being mirrored into the portable tree.
`PortableTemplateRoot/package.json` and `PortableTemplateRoot/bun.lock` must
also match the current repo, so an older portable template cannot be used to
seed a newer mainline dependency base.
The refresh step also writes `.portable-deps-stamp.json`, which records the
repo `package.json` and `bun.lock` hashes that the portable dependency base was
last refreshed against. Release packaging now requires that stamp to exist and
match the current repo manifests. If a dependency refresh fails mid-copy, the
old stamp is removed so release packaging cannot trust a stale success record.

Use dependency refresh only when one of these changed:

- `package.json`
- `bun.lock`
- runtime layout or launcher/runtime expectations
- bundled dependency packaging requirements

For normal mainline source changes, portable sync should only move source and scripts, not reinstall or mirror node packages.
