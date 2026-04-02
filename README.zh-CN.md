# recode

[![English](https://img.shields.io/badge/README-English-0ea5e9?style=for-the-badge)](./README.md)
[![简体中文](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-38bdf8?style=for-the-badge)](./README.zh-CN.md)

## Bun + TypeScript 终端编程助手

`recode` 是我自己的终端编程助手项目。

这个仓库的目标不是做一个泛泛的替代品，而是把有价值的源码结构、运行链路、命令体系和配置体系真正整理成一个能运行、能配置、能继续开发的 Bun + TypeScript 项目。

当前版本：`0.0.1`

## 项目快照

| 项目 | 数值 |
|---|---|
| 版本 | `0.0.1` |
| 运行时 | Bun |
| 语言 | TypeScript |
| 源码文件数（`.ts` / `.tsx`） | `2781` |
| 命令模块数（`src/commands/*`） | `94` |
| 工具模块数（`src/tools/*`） | `55` |
| Workspace 包数量 | `6` |
| 已验证 CLI / headless 命令数量 | `13` |
| 测试文件数 | `7` |
| 文档文件数（`docs/*.md` / `docs/*.mdx`） | `30` |

## 这是什么

- 一个 Bun + TypeScript 终端编程助手
- 一个我自己持续修复、验证和扩展的可运行仓库
- 一个强调源码行为和真实可用性的项目，而不是演示壳子

## 当前状态

| 领域 | 状态 | 说明 |
|---|---|---|
| CLI 启动 | 可用 | `recode --help` 和 `recode --version` 已验证 |
| headless prompt 模式 | 可用 | `recode -p "<prompt>"` 已验证 |
| headless slash commands | 可用 | `/help`、`/status`、`/doctor`、`/model-map` 已验证 |
| 交互式 REPL | 可用 | 当前推荐日常入口是 `.\recode.cmd` |
| 模型别名映射 | 可用 | `/model-map` 支持 Opus / Sonnet / Haiku 三组映射 |
| context cap 持久化 | 可用 | `/model-map context 258k` 已验证 |
| 本地 provider 配置 | 可用 | 项目内 `.recode/local-provider.json` 路径可用 |
| CPA 风格 provider 路由 | 可用 | `gpt-5.4(high)` 这类后缀透传已接通 |
| MCP / 插件 / agents 管理面 | 可用 | 高价值管理命令路径已验证 |
| 打包产物 `dist/cli.js` | 部分可用 | 可作为构建验证入口，不建议作为长会话主入口 |

## 当前已经能用的部分

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

当前值得直接试的交互命令：

- `/model`
- `/model-map`
- `/status`
- `/doctor`
- `/mcp`
- `/plugin`
- `/tasks`

## 快速开始

环境要求：

- Bun `>= 1.2.0`

安装依赖：

```bash
bun install
```

源码模式启动：

```bash
bun run dev
```

在仓库里直接启动：

```bash
.\recode.cmd
```

构建：

```bash
bun run build
```

运行构建产物：

```bash
bun ./dist/cli.js
```

当前建议：

- 日常本地使用优先走 `.\recode.cmd`
- `bun ./dist/cli.js` 目前主要保留为构建验证路径

## 本地配置

`recode` 支持项目内 provider 配置，主要文件是：

- `.recode/local-provider.json`
- `.recode/local-provider.example.json`
- `.recode/api-key.txt`

这套本地配置可以承载：

- 自定义 API host
- API key 文件路径
- 默认模型
- 默认 effort
- `/model-map` 的 `Opus / Sonnet / Haiku` 三组映射
- 例如 `258000` 这样的 context cap

示例：

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

## 仓库结构

主要目录：

- `src/` 应用源码
- `packages/` workspace 包
- `docs/` 状态、审计、对齐文档
- `.recode/` 本地 provider 配置示例

相关文档：

- [源码对齐清单](./docs/SOURCE_PARITY_CHECKLIST.md)
- [当前状态](./docs/STATUS.md)
- [命令与工具审计](./docs/COMMAND_TOOL_AUDIT.md)
- [工作日志](./docs/WORKLOG.md)

## 致谢

- 当前仓库以 `recode` 的名义独立维护。
- 它的 Bun + TypeScript 工程基座来自此前围绕 Claude Code CLI 所做的开源逆向与恢复工作，其中包括 `claude-code-best/claude-code` 这一类项目。
- 当前仓库的目录整理、打包方式、配置流和后续开发由 `recode` 继续维护。

## 声明

- 这是我自己的仓库，也是我自己继续维护和开发的项目。
- 它延续了此前一套同类 CLI 源码恢复与工程整理工作，但当前仓库本身是我自己的持续开发项目。
- 它不是 Anthropic 官方仓库。
- Claude Code、Anthropic 和上游产品标识仍然属于 Anthropic。
