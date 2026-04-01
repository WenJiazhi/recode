# recode

[![English](https://img.shields.io/badge/README-English-0ea5e9?style=for-the-badge)](./README.md)
[![简体中文](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-38bdf8?style=for-the-badge)](./README.zh-CN.md)

## Bun + TypeScript Terminal Coding Assistant

`recode` is my own terminal coding assistant project.

This repository is a working Bun + TypeScript CLI that I am actively repairing, verifying, packaging, and extending. The goal is not to ship a vague demo. The goal is to keep the useful runtime structure, fix what is broken, and turn it into a tool that can actually be used day to day.

Current version: `0.0.1`

## What It Is

- a Bun + TypeScript terminal coding assistant
- a real repository that I continue to maintain and improve
- a project that values runtime behavior and usability over mockups

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

## recode-specific Work

This repository is not just a raw source snapshot. It already includes `recode`-specific work:

- renamed the command and visible product name to `recode`
- standardized the release version to `0.0.1`
- switched the main accent color to sky blue
- repaired headless slash command paths like `/help`, `/status`, and `/doctor`
- added `/model-map` for alias-to-model mapping
- added project-local CPA/provider configuration
- added context-cap persistence through `/model-map context 258k`
- repaired the `/config` crash caused by the dead `Gates` settings reference

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

## Notes

- This is my own repository and my own ongoing development work.
- It continues from earlier source recovery and engineering work around a similar CLI codebase.
- It is not an official Anthropic repository.
