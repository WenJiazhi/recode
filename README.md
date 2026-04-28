# recode

[![English](https://img.shields.io/badge/README-English-0ea5e9?style=for-the-badge)](./README.md)
[![Simplified Chinese](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-38bdf8?style=for-the-badge)](./README.zh-CN.md)

## Bun + TypeScript Terminal Coding Assistant

`recode` is a Bun + TypeScript terminal coding assistant maintained as its own repository and product line. The current direction is still the same: rebuild the useful Claude Code/CCB baseline into a programming-first terminal tool that is actually usable every day, then keep merging only the meaningful upstream slices instead of inventing a new product surface.

Current version: `0.0.1`

## Project Snapshot

| Item | Value |
| --- | --- |
| Version | `0.0.1` |
| Runtime | Bun |
| Language | TypeScript |
| Source files (`src/**/*.ts,tsx`) | `2850` |
| Command modules (`src/commands/*`) | `95` |
| Tool modules (`src/tools/*`) | `55` |
| Workspace packages | `6` |
| Docs files (`docs/*.md` / `docs/*.mdx`) | `34` |
| Current local test result | `224 pass / 0 fail` |
| Current lint snapshot | `clean / 0 blocking errors` |

## Rebuild Board

| Track | Status | Already Done | Remaining Gap | Next Step |
| --- | --- | --- | --- | --- |
| CLI startup and entrypoints | Ready | `recode --help`, `--version`, source-first launcher, packaged build, external-cwd startup | `dist/cli.js` is still verification-first for very long sessions | keep source entry as the daily launcher |
| Headless commands and prompt loop | Ready | `/help`, `/status`, `/doctor`, `/files`, `/diff`, `/tasks`, `/context`, `/review`, `/commit`, `/model-map`, `/brief`, `/voice`, `/chrome`, `/ultraplan`, `/remote-control` all route cleanly | long-tail low-frequency commands still need occasional audit | keep the command surface predictable |
| Interactive REPL | Usable | core REPL, settings/config, auto mode carousel, key command surfaces | lower-traffic UI fidelity still trails the original | keep polishing without rewriting the interaction model |
| Review / commit workflow | Partial | prompt generation and shared shell expansion are regression-tested; headless fallbacks are correct | deeper interactive GitHub publishing flow is still intentionally conservative | verify more interactive-safe flows without remote side effects |
| LSP and code intelligence | Partial | local `.recode/lsp.json`, manager routing, recommendation chain, diagnostics, and a real definition request path are all working and tested | daily use still depends on a real installed server on the user's machine | keep improving setup discoverability and local-server guidance |
| Branch / worktree / session continuity | Partial | create/cleanup/dirty detection, `.worktreeinclude`, keep/reuse, agent worktrees, resume continuity, and permission round-tripping are covered by tests | more interactive parity is still worth checking | keep validating interactive git/session paths without weakening safety |
| Provider routing and CPA support | Ready | local provider config, key-file flow, CPA routing, custom `/v1/models`, alias mapping, context caps | lower-traffic provider edges still exist | keep custom-provider behavior isolated from Anthropic-only probes |
| CCB feature alignment | Ready | items `1-16` are merged: OpenAI tool-calling, local gates, `[local]` labels, interview shim, ultraplan, voice, bridge, computer-use/chrome-use, brief, away-summary, token-budget, prompt-cache-break, verification-agent, agent-triggers / explore-plan gate alignment, extract-memories / Lodestone gate alignment, shot-stats gate alignment | remaining work is post-merge hardening, not missing feature slices | keep source-faithful verification and cleanup |
| Windows computer-use / chrome-use | Partial | cross-platform executor, input/swift backends, real MCP packages, `open_terminal` fallback, terminal `request_access`, and `bind_window` smoke all work in-repo | outer desktop wrapper issues can still exist outside this repo | keep hardening the Windows integration chain without re-inventing the runtime |

## CCB Alignment Board

| Order | Item | State |
| --- | --- | --- |
| 1 | OpenAI adapter tool-calling compatibility | `completed` |
| 2 | GrowthBook local gate defaults for coding-critical P0/P1 features | `completed` |
| 3 | Project-local skill `[local]` labels | `completed` |
| 4 | Interview shim over existing runtime | `completed` |
| 5 | Ultraplan gate/runtime alignment | `completed` |
| 6 | Voice gate/runtime alignment | `completed` |
| 7 | Bridge gate/runtime alignment | `completed` |
| 8 | Computer-use / Chrome-use alignment | `completed` |
| 9 | Brief / `KAIROS_BRIEF` | `completed` |
| 10 | Away summary / `AWAY_SUMMARY` | `completed` |
| 11 | Token budget / `TOKEN_BUDGET` | `completed` |
| 12 | Prompt cache break detection / `PROMPT_CACHE_BREAK_DETECTION` | `completed` |
| 13 | Verification agent / `VERIFICATION_AGENT` | `completed` |

## CPA Support Matrix

| Capability | Status | Notes |
| --- | --- | --- |
| Project-local provider config | Ready | `.recode/local-provider.json` is the main local routing entry |
| Local API key file | Ready | `.recode/api-key.txt` stays outside git |
| Provider type routing | Ready | `providerType` + `baseURL` decide the active provider path |
| CPA base URL | Ready | current project-local flow supports `https://cpa.cpapi.app` |
| Custom `/v1/models` discovery | Ready | custom-host model discovery and capability cache are active |
| Alias mapping | Ready | `/model-map` configures `Opus`, `Sonnet`, and `Haiku` independently |
| Thinking suffix passthrough | Ready | names such as `gpt-5.4(high)` are preserved |
| Context cap persistence | Ready | `/model-map context 258k` stores `258000` tokens |
| Auto mode on CPA GPT-5 routes | Ready | CPA/OpenAI GPT-5 routes no longer fail old Claude-only auto-mode gating |
| Project-local LSP config | Ready | `.recode/lsp.json` is a valid local server discovery path |

## Verified Right Now

| Area | Verified Commands / Paths |
| --- | --- |
| CLI | `recode --help`, `recode --version`, `recode -p "<prompt>"` |
| Headless built-ins | `recode -p "/help"`, `"/status"`, `"/doctor"`, `"/files"`, `"/diff"`, `"/tasks"`, `"/context"`, `"/review"`, `"/commit"` |
| Interactive-only fallback routing | `"/config"`, `"/model"`, `"/branch"`, `"/compact"`, `"/init"`, `"/commit-push-pr"`, `"/brief"`, `"/voice"`, `"/chrome"`, `"/ultraplan"`, `"/remote-control"` |
| Model and auto mode | `recode --permission-mode auto -p "hi"`, `recode auto-mode defaults`, `recode -p "/model-map status"` |
| Provider / CPA | live CPA-backed `-p` requests, project-local provider loading, `/model-map context 258k` |
| LSP | `.recode/lsp.json`, `/doctor`, `/status`, recommendation/error guidance, end-to-end local definition request test |
| MCP / plugins / agents | `recode auth status`, `recode agents`, `recode mcp --help`, `recode mcp list`, `recode plugin list` |
| Windows computer-use | `--computer-use-mcp`, `open_terminal`, terminal `request_access`, and `bind_window` repo-level smoke tests |

## Current Sprint Order

| Priority | Item | Why It Is Next |
| --- | --- | --- |
| P1 | Progress-table refresh and remaining lint cleanup | the runtime is green, so the next highest-value work is reducing maintenance noise and keeping the state boards honest |
| P2 | Windows desktop-control hardening | the in-repo chain is much better now, but the remaining real-world friction is in the terminal/window integration path |
| P3 | interactive review / commit / branch / worktree verification | the core coding loop is in place, so the next meaningful safety work is deeper interactive verification |
| P4 | lower-traffic brand / wording cleanup | important, but now secondary to stability and maintainability |

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

- use `.\recode.cmd` or `recode` for normal local sessions
- treat `bun ./dist/cli.js` as a build verification path, not the preferred long-session launcher

## Repository Docs

| Document | Purpose |
| --- | --- |
| [docs/SOURCE_PARITY_CHECKLIST.md](./docs/SOURCE_PARITY_CHECKLIST.md) | source/base parity tracking against the restored tree |
| [docs/STATUS.md](./docs/STATUS.md) | current verification snapshot and usable paths |
| [docs/CCB_MERGE_PLAN.md](./docs/CCB_MERGE_PLAN.md) | current CCB alignment ledger and post-merge deltas |
| [docs/PRIORITY_REBUILD_BACKLOG.md](./docs/PRIORITY_REBUILD_BACKLOG.md) | highest-value remaining work in order |
| [docs/COMMAND_TOOL_AUDIT.md](./docs/COMMAND_TOOL_AUDIT.md) | verified command and tool coverage |
| [docs/WORKLOG.md](./docs/WORKLOG.md) | implementation log of completed repair work |
| `.recode/lsp.example.json` | example project-local LSP server config |

## Acknowledgements

| Item | Notes |
| --- | --- |
| Current maintenance | this repository is maintained independently as `recode` |
| Engineering baseline | the Bun + TypeScript baseline was bootstrapped from earlier open reverse-engineering and restoration work around the Claude Code CLI, including `claude-code-best/claude-code` |
| Current ownership | the directory structure, packaging, CPA support work, config flow, and ongoing rebuild direction are maintained in this repository |

## Notes

- This is not an official Anthropic repository.
- The project direction is still source-faithful rebuild first, not cosmetic feature inflation.
- The tables above are intended to stay honest: what is done, what is left, and what is next.
