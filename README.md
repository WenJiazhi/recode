# recode

[![English](https://img.shields.io/badge/README-English-0ea5e9?style=for-the-badge)](./README.md)
[![简体中文](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-38bdf8?style=for-the-badge)](./README.zh-CN.md)

## Bun + TypeScript Terminal Coding Assistant

`recode` is my own terminal coding assistant project.

This repository is a working Bun + TypeScript CLI that I am actively repairing, verifying, packaging, and extending. The goal is not to ship a vague demo. The goal is to keep the useful runtime structure, fix what is broken, and turn it into a tool that can actually be used day to day.

Current version: `0.0.1`

## Project Snapshot

| Item | Value |
|---|---|
| Version | `0.0.1` |
| Runtime | Bun |
| Language | TypeScript |
| Source files (`.ts` / `.tsx`) | `2781` |
| Command modules (`src/commands/*`) | `94` |
| Tool modules (`src/tools/*`) | `55` |
| Workspace packages | `6` |
| Verified CLI/headless commands | `13` |
| Test files | `7` |
| Docs files (`docs/*.md` / `docs/*.mdx`) | `30` |

## What It Is

- a Bun + TypeScript terminal coding assistant
- a real repository that I continue to maintain and improve
- a project that values runtime behavior and usability over mockups

## Current Status

| Area | Status | Notes |
|---|---|---|
| CLI startup | Ready | `recode --help` and `recode --version` verified |
| Headless prompt mode | Ready | `recode -p "<prompt>"` verified |
| Headless slash commands | Ready | `/help`, `/status`, `/doctor`, `/model-map` verified |
| Interactive REPL | Usable | recommended daily entry is `.\recode.cmd` |
| Model alias mapping | Ready | `/model-map` supports Opus / Sonnet / Haiku mapping |
| Context cap persistence | Ready | `/model-map context 258k` verified |
| Local provider config | Ready | project-local `.recode/local-provider.json` path works |
| CPA-style provider routing | Ready | suffix passthrough such as `gpt-5.4(high)` works |
| MCP / plugins / agents commands | Ready | high-value management paths verified |
| Bundled `dist/cli.js` | Partial | build output works for verification, not the preferred long-session entry |

## What Works Now

- `recode --help`
- `recode --version`
- `recode -p "<prompt>"`
- `recode -p "/help"`
- `recode -p "/status"`
- `recode -p "/doctor"`
- `recode -p "/model-map help"`
- `recode -p "/model-map status"`
- `recode auth status`
- `recode agents`
- `recode mcp --help`
- `recode mcp list`
- `recode plugin list`

Interactive paths already worth trying:

- `/model`
- `/model-map`
- `/status`
- `/doctor`
- `/mcp`
- `/plugin`
- `/tasks`

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
- keep `bun ./dist/cli.js` mainly for build verification

## Portable Config

`recode` supports project-local provider configuration through:

- `.recode/local-provider.json`
- `.recode/local-provider.example.json`
- `.recode/api-key.txt`

This local config can carry:

- custom API host
- API key file path
- default model
- default effort level
- `Opus` / `Sonnet` / `Haiku` mappings for `/model-map`
- context cap overrides such as `258000`

Example:

```json
{
  "enabled": true,
  "providerType": "cpa",
  "baseURL": "https://cpa.cpapi.app",
  "apiKeyFile": "./api-key.txt",
  "settings": {
    "model": "opus[1m]",
    "effortLevel": "high",
    "env": {
      "CLAUDE_CODE_MAX_CONTEXT_TOKENS": "258000"
    },
    "customModelAliasMappings": {
      "opus": { "model": "gpt-5.4", "thinking": "high" },
      "sonnet": { "model": "gpt-5.4", "thinking": "medium" },
      "haiku": { "model": "gpt-5.4-mini", "thinking": "minimal" }
    }
  }
}
```

## Repository Notes

Main directories:

- `src/` application source
- `packages/` workspace packages
- `docs/` status, audit, and parity notes
- `.recode/` local provider config examples

Status documents:

- [Source parity checklist](./docs/SOURCE_PARITY_CHECKLIST.md)
- [Current status](./docs/STATUS.md)
- [Command and tool audit](./docs/COMMAND_TOOL_AUDIT.md)
- [Worklog](./docs/WORKLOG.md)

## Acknowledgements

- The current repository is maintained independently as `recode`.
- Its Bun + TypeScript engineering baseline was bootstrapped from prior open reverse-engineering and restoration work around the Claude Code CLI, including the `claude-code-best/claude-code` project.
- The current repository structure, packaging, configuration flow, and follow-up development are maintained here as part of the `recode` project.

## Notes

- This is my own repository and my own ongoing development work.
- It continues from earlier source recovery and engineering work around a similar CLI codebase.
- It is not an official Anthropic repository.
