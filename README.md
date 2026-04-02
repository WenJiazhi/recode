# recode

[![English](https://img.shields.io/badge/README-English-0ea5e9?style=for-the-badge)](./README.md)
[![Simplified Chinese](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-38bdf8?style=for-the-badge)](./README.zh-CN.md)

## Bun + TypeScript Terminal Coding Assistant

`recode` is a Bun + TypeScript terminal coding assistant project maintained as its own repository and product line. It is best understood as a programming-first Claude Code rebuild and secondary development project: keep the useful CLI/runtime structure, repair the broken programming paths, and turn the rebuilt codebase into something that is actually usable for day-to-day coding.

Current version: `0.0.1`

## Project Snapshot

| Item | Value |
| --- | --- |
| Version | `0.0.1` |
| Runtime | Bun |
| Language | TypeScript |
| Source files (`.ts` / `.tsx`) | `2786` |
| Command modules (`src/commands/*`) | `94` |
| Tool modules (`src/tools/*`) | `55` |
| Workspace packages | `6` |
| Docs files (`docs/*.md` / `docs/*.mdx`) | `33` |
| Current local test result | `59 pass / 0 fail` |

## Rebuild Board

This is the mainline status board for the current repository. It is ordered around real coding value, not around cosmetic parity.

| Track | Status | Already Done | Not Done Yet | Next Step |
| --- | --- | --- | --- | --- |
| CLI startup and entrypoints | Ready | `recode --help`, `recode --version`, source-entry launcher, build pipeline | bundled `dist/cli.js` is still not the preferred long-session entry | keep `src/entrypoints/cli.tsx` as the stable daily launcher |
| Headless prompt and slash commands | Ready | `/help`, `/status`, `/doctor`, `/files`, `/diff`, `/tasks`, `/review`, `/commit`, `/model-map` | broader audit still incomplete across the full command tree | keep expanding high-value command coverage in priority order |
| Interactive REPL | Usable | main REPL starts and the core command surface is available | full UI fidelity is still below the original interactive experience | continue source-faithful UI repairs after coding-critical paths |
| Review and commit workflow | Partial | `/review` and `/commit` are verified, built-in registration restored | `/commit-push-pr` is still interactive-only until the full GitHub path is verified | validate the end-to-end push/PR path without weakening safety |
| LSP and code intelligence | Partial | LSP tool is registered, project-local `.recode/lsp.json` discovery works, a real request/response path is verified when a server is available, and `/doctor` + `/status` now report live LSP config/manager health | day-to-day setup still depends on the user providing at least one working local or plugin server | turn the verified local-server path into a more obvious daily-use workflow |
| Branch/worktree/git workflow | Partial | branch/worktree command paths are present, `/branch` fallback is correct in headless mode, and real git worktree create/cleanup/dirty detection is covered by tests | interactive worktree parity still needs more end-to-end validation | keep validating interactive branch/worktree flows without loosening git safety |
| MCP / plugins / agents | Partial | high-value list/help/management paths are working | deeper lifecycle compatibility still needs audit | keep validating the most-used plugin and MCP flows |
| Provider routing and config | Ready | project-local provider config, local API key file, CPA routing, custom `/v1/models`, alias mappings | lower-traffic provider edge cases still exist | continue keeping custom-provider behavior isolated from Anthropic-only paths |
| Remote / bridge / voice / workflows | Gated | source tree is present | these are not active daily-use priorities yet | leave gated until the local coding loop is stable |

## CPA Support Matrix

This is the most important `recode`-specific enhancement area right now.

| Capability | Status | Notes |
| --- | --- | --- |
| Project-local provider config | Ready | `.recode/local-provider.json` is the primary local config path |
| Local API key file | Ready | `.recode/api-key.txt` is supported and stays outside git |
| Provider type routing | Ready | `providerType` + `baseURL` decide the active provider path |
| CPA base URL | Ready | current project-local flow supports `https://cpa.cpapi.app` |
| Custom `/v1/models` discovery | Ready | custom-host model discovery and cache are active |
| Alias mapping | Ready | `/model-map` configures `Opus`, `Sonnet`, and `Haiku` separately |
| Thinking suffix passthrough | Ready | CPA-style names such as `gpt-5.4(high)` are preserved |
| Context cap persistence | Ready | `/model-map context 258k` stores `258000` tokens |
| Portable config carry-over | Ready | portable runtime can carry the local `.recode` folder |
| Project-local LSP config | Ready | `.recode/lsp.json` is now a valid local server discovery path |

## Verified Right Now

| Area | Verified Commands / Paths |
| --- | --- |
| CLI | `recode --help`, `recode --version`, `recode -p "<prompt>"` |
| Headless built-ins | `recode -p "/help"`, `recode -p "/status"`, `recode -p "/doctor"`, `recode -p "/files"`, `recode -p "/diff"`, `recode -p "/tasks"`, `recode -p "/review"`, `recode -p "/commit"` |
| Headless fallback messaging | `recode -p "/config"`, `recode -p "/model"`, `recode -p "/commit-push-pr"` |
| Model mapping | `recode -p "/model-map help"`, `recode -p "/model-map status"`, `recode -p "/model-map context 258k"` |
| Management surfaces | `recode auth status`, `recode agents`, `recode mcp --help`, `recode mcp list`, `recode plugin list` |

## Current Sprint Order

| Priority | Item | Why It Is Next |
| --- | --- | --- |
| P1 | LSP daily-use polish | the runtime now reports live LSP config and manager health, but the local-server workflow still needs to be easier to discover and trust |
| P2 | branch/worktree interactive parity | the git safety layer is now tested, so the next step is user-facing interactive confidence |
| P3 | context inspection parity | `/context` is important for understanding prompt pressure, tools, and memory |
| P4 | remaining headless routing gaps | source presence is not enough; command behavior must be predictable |
| P5 | permissions/tool gating recheck | tool availability must stay stable while the rebuild continues |

## Quick Start

Requirements:

- Bun `>= 1.2.0`

Install dependencies:

```bash
bun install
```

Run from source:

```bash
bun run dev
```

Run from the repository launcher:

```bash
.\recode.cmd
```

Build:

```bash
bun run build
```

Built CLI:

```bash
bun ./dist/cli.js
```

Recommended usage:

- use `.\recode.cmd` for normal local sessions
- treat `bun ./dist/cli.js` as a build verification path, not the preferred long-session launcher

## Repository Docs

| Document | Purpose |
| --- | --- |
| [docs/SOURCE_PARITY_CHECKLIST.md](./docs/SOURCE_PARITY_CHECKLIST.md) | module-by-module parity tracking against the source tree |
| [docs/STATUS.md](./docs/STATUS.md) | current verification snapshot and usable paths |
| [docs/COMMAND_TOOL_AUDIT.md](./docs/COMMAND_TOOL_AUDIT.md) | verified command and tool coverage |
| [docs/PRIORITY_REBUILD_BACKLOG.md](./docs/PRIORITY_REBUILD_BACKLOG.md) | high-value rebuild order from top to bottom |
| [docs/WORKLOG.md](./docs/WORKLOG.md) | implementation log of completed repair work |
| `docs/archive/` | older migration notes kept out of the repository root |
| `.recode/lsp.example.json` | example project-local LSP server config |

## Acknowledgements

| Item | Notes |
| --- | --- |
| Current maintenance | this repository is maintained independently as `recode` |
| Engineering baseline | the Bun + TypeScript baseline was bootstrapped from earlier open reverse-engineering and restoration work around the Claude Code CLI, including `claude-code-best/claude-code` |
| Current ownership | the directory structure, packaging, CPA support work, config flow, and ongoing rebuild direction are maintained in this repository |

## Notes

- This is not an official Anthropic repository.
- The repository is focused on a programming-first rebuild, not on claiming complete parity before verification.
- The homepage tables are meant to stay honest: what is done, what is not done, and what is next.
