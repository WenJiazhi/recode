# Contributing to Recode

## Setup

```bash
git clone https://github.com/WenJiazhi/recode.git
cd recode
bun install --frozen-lockfile
```

Optional local Git hooks can be enabled with `bun run setup:hooks`.

## Development Workflow

1. Register user-visible features in
   [the roadmap](./docs/development/roadmap.mdx).
2. Do not implement a proposed feature until its scope is approved.
3. Create a focused branch from the current release baseline.
4. Keep behavior changes scoped and add regression coverage.
5. Run `bun run health` before proposing a release.
6. Update user-facing documentation when commands or configuration change.
7. Open a pull request that explains the backlog ID, behavior change, and tests.

Use `feat/<id>-<name>`, `fix/<name>`, `docs/<name>`, or `chore/<name>` branch
names. Commit messages follow Conventional Commits. See
[Git and release workflow](./docs/development/git-workflow.mdx).

## Code Style

- Follow the existing TypeScript and Biome configuration.
- Prefer existing service and utility boundaries over new global state.
- Avoid broad formatting changes in files unrelated to the behavior change.
- Treat permission, shell, credential, and worktree code as security-sensitive.
- Treat Knip output as an audit input, not an automatic deletion list.

## Reporting Bugs

Include the Recode version, Bun version, operating system, reproduction steps,
expected behavior, and sanitized logs. Do not include API keys, tokens, private
repository content, or internal service URLs.

Security vulnerabilities should follow [SECURITY.md](./SECURITY.md), not a
public issue.
