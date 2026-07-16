# Recode

[![CI](https://github.com/WenJiazhi/recode/actions/workflows/ci.yml/badge.svg)](https://github.com/WenJiazhi/recode/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3.14-black.svg)](https://bun.sh)

[简体中文](./README.zh-CN.md)

Recode is a terminal coding agent built with Bun and TypeScript. It combines a
streaming agent loop, local development tools, provider routing, MCP, skills,
plugins, LSP integration, and worktree-aware sessions in one CLI.

Recode ships as standalone macOS and Linux binaries. The repository also
supports source-based development with Bun; npm publishing is intentionally
out of scope for the `0.0.1` release.

## Highlights

- File, search, shell, Git, task, and code-intelligence tools
- Interactive terminal UI and non-interactive `-p` mode
- Anthropic, OpenAI-compatible, CPA, Bedrock, Vertex, and Foundry routing
- MCP servers, plugins, skills, hooks, and custom agents
- Session resume, context compaction, memory, and isolated Git worktrees
- Persistent autonomous Goals with checkpoints, token budgets, and resume
- Declarative multi-agent workflows with DAG scheduling, cancellation, and resume
- ACP stdio integration for editors and other standard Agent clients
- Optional desktop-control integration

## Requirements

- A key or credential chain for the provider you select
- Git for repository-aware workflows

Building from source additionally requires Bun `1.3.14` or newer.

## Quick Start

Install the latest macOS or Linux release to `~/.local/bin/recode`:

```bash
curl -fsSL https://raw.githubusercontent.com/WenJiazhi/recode/main/install.sh | sh
recode --version
```

The installer selects the current platform and architecture, verifies the
release SHA-256 checksum, and then installs Recode with its search runtime.
Override the destination with `RECODE_INSTALL_DIR` or pin a release with
`RECODE_VERSION=v0.0.1`.

Build from a local checkout instead:

```bash
./scripts/install-local.sh
recode --version
```

Run from source:

```bash
git clone https://github.com/WenJiazhi/recode.git
cd recode
bun install --frozen-lockfile
bun run dev
```

Run a single non-interactive prompt:

```bash
bun run dev -p "summarize this repository"
```

Build and inspect the bundled CLI:

```bash
bun run build
bun run start --help
```

## Provider Configuration

By default, Recode reads the existing `~/.claude/settings.json` on the machine
and uses its provider, base URL, credentials, and model-family mappings. A
`/model` selection applies to the current session; the next process starts from
the existing configuration again.

Run `/provider` to switch between two configuration sources:

- `.claude` follows the external `~/.claude/settings.json` configuration.
- `.recode` reads the CC Switch Provider catalog at
  `~/.cc-switch/cc-switch.db` in read-only mode and keeps Recode's selected
  Provider independent from CC Switch's active item. Set
  `RECODE_PROVIDER_CATALOG_DB` to use a compatible catalog at another path.

The source tabs use Left/Right. Selecting a `.recode` Provider applies its URL,
API-key authentication, and model-family mappings to the next request without
restarting the CLI, then opens the model and effort picker. Recode never writes
to the external catalog. Only API-key-compatible catalog entries can be
activated.

Source and Provider selections are stored in `.recode/local-provider.json`.
Project configuration takes priority; otherwise Recode falls back to
`~/.recode/local-provider.json` so the selection works across directories.
Without a readable Provider catalog, `.claude` remains available and the
`.recode` tab reports the missing catalog instead of changing configuration.

Recode also accepts the standard provider environment variables used by its SDKs.
For project-local OpenAI-compatible or CPA routing, use the ignored
`.recode/local-provider.json` file. A complete template is available at
[.recode/local-provider.example.json](./.recode/local-provider.example.json).

```json
{
  "enabled": true,
  "providerType": "openai",
  "baseURL": "https://api.example.com",
  "apiKeyFile": "./api-key.txt",
  "settings": {
    "model": "your-model"
  }
}
```

Keep secrets in `.recode/api-key.txt` or your environment. Both local files
are excluded from Git.
Supported `providerType` values are `anthropic`, `cpa`, and `openai`.
Invalid local configuration is reported at startup instead of silently ignored.
The current build is API-key-only; Anthropic account OAuth and subscription-only
commands are frozen and do not appear in the CLI.

## Persistent Goals

Use `/goal` for work that should continue across multiple top-level agent turns:

```text
/goal --budget 80k implement the parser, tests, and documentation
/goal
/goal checkpoint parser and unit tests are complete
/goal pause
/goal resume
/goal budget 120k
/goal complete
```

An active Goal continues only while the REPL is idle, the user queue is empty,
no dialog is open, and plan mode is inactive. Goal continuations use lower queue
priority than user input. Pressing Escape during a Goal turn pauses it; provider
errors, token budgets, and the automatic continuation cap also stop cleanly
instead of retrying indefinitely.

Goal state, token usage, and milestone checkpoints are stored in the session
JSONL and restored by `/resume`. The model can inspect the Goal, record a
checkpoint, and report verified completion through the `Goal` tool. A blocked
state requires the same reason across three consecutive Goal turns.

See [Persistent Goals](./docs/conversation/persistent-goals.mdx) for the command
lifecycle and architecture.

## Multi-Agent Workflows

Use `/orchestrate` when a task benefits from independent investigation followed
by dependency-ordered synthesis or implementation:

```text
/orchestrate review the auth flow and apply only verified fixes
/workflows
/workflows templates
/workflows run target-review src/auth
/workflows <run-id>
/workflows stop <run-id>
/workflows resume <run-id>
/workflows concurrency <run-id> <1-6>
/workflows budget <run-id> <tokens|none>
```

Recode validates a bounded declarative DAG, runs independent read workers in
parallel, and serializes shared-directory writes. Write steps can opt into Git
worktree isolation so independent changes run concurrently and merge back as
checked binary patches; conflicts retain the worktree without partially
overwriting the project. A run can set a cumulative token admission budget and
change its concurrency limit while active. In-flight workers finish after the
budget is reached, so concurrent requests can produce bounded overshoot; pending
steps remain resumable. Known models receive a local cost estimate, while custom
models or missing Provider usage keep the estimate explicitly incomplete. Each run
has an ignored v4 event journal under
`.recode/workflow-runs/`; resume reuses completed steps and recovers checkpointed
merges without rerunning the agent. Workers use the current Provider and
permission chain, cannot recursively spawn built-in orchestration tools, and do
not execute arbitrary workflow scripts.

Reusable project templates live in `.recode/workflows/*.json` or `*.jsonc`.
They wrap the same validated DAG specification and may declare a literal
`$ARGUMENTS` placeholder for objective and step prompts. Valid non-conflicting
template names also appear as `/name` commands; `/workflows run` remains the
deterministic entry point. Templates never execute JavaScript or shell code.

See [Declarative multi-agent workflows](./docs/agent/workflow-orchestration.mdx)
for scheduling, persistence, safety boundaries, and current limitations.

## ACP Integration

Run Recode as a standard Agent Client Protocol server over stdio:

```bash
recode --acp
```

The ACP entry supports initialization, new and loaded sessions, streaming text
and thinking, tool and plan updates, client-side permission decisions, prompt
cancellation, and JSONL-backed resume. Each ACP session delegates to the same
Provider, permission system, tools, and stream-json Agent loop used by the CLI;
it does not maintain a second execution engine. Non-text content is surfaced
explicitly when a client cannot forward it losslessly.

See [ACP stdio integration](./docs/extensibility/acp.mdx) for client scope,
transport boundaries, and verification.

## Architecture

```text
src/entrypoints/cli.tsx   CLI bootstrap and provider initialization
src/main.tsx              command routing and terminal application startup
src/query.ts              streaming agent and tool-execution loop
src/QueryEngine.ts        multi-turn headless session engine
src/tools/                built-in tool implementations
src/commands/             slash commands and workflow entry points
src/services/             API, MCP, LSP, analytics, and compaction services
src/utils/                configuration, permissions, sessions, and worktrees
packages/@recode/         browser and desktop-control workspace packages
```

The architecture guide starts at
[What is Recode?](./docs/introduction/what-is-recode.mdx).
The current product surface is summarized in
[Capabilities](./docs/introduction/capabilities.mdx).

## Development

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:provider-e2e
bun run test:acp-e2e
```

Tests run one file per process because Bun module mocks are process-global.
This keeps the full suite deterministic and prevents mock state from leaking
between unrelated files. The Provider E2E command additionally runs real source
and bundled CLI processes against isolated loopback Anthropic-compatible and
OpenAI-compatible SSE servers; it never reads a real API key.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development workflow and
[SECURITY.md](./SECURITY.md) for vulnerability reporting.

## License

Licensed under the [Apache License 2.0](./LICENSE). See [NOTICE](./NOTICE) for
project and trademark notices. Third-party dependencies remain under their
respective licenses.
