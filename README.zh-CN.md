# recode

[![English](https://img.shields.io/badge/README-English-0ea5e9?style=for-the-badge)](./README.md)
[![简体中文](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-38bdf8?style=for-the-badge)](./README.zh-CN.md)

## Bun + TypeScript 终端编程助手

`recode` 是我自己的终端编程助手项目。

这个仓库的目标不是做一个泛泛的替代品，而是把有价值的源码结构、运行链路、命令体系和配置体系真正整理成一个能运行、能配置、能继续开发的 Bun + TypeScript 项目。

当前版本：`0.0.1`

## 这是什么

- 一个 Bun + TypeScript 终端编程助手
- 一个我自己持续修复、验证和扩展的可运行仓库
- 一个强调源码行为和真实可用性的项目，而不是演示壳子

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

## recode 额外做的内容

这个仓库不只是把源码摆上来，当前已经有一批明确属于 `recode` 自己的工作：

- 把命令名和主要产品名改成 `recode`
- 版本统一为 `0.0.1`
- 主品牌色改成天蓝色
- 修好 `/help`、`/status`、`/doctor` 等 headless slash command 路径
- 增加 `/model-map` 做三组 alias 映射
- 增加项目内 CPA/provider 配置
- 增加 `/model-map context 258k` 这种 context cap 持久化能力
- 修好 `/config` 因为失效 `Gates` 引用导致的崩溃

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

## 声明

- 这是我自己的仓库，也是我自己继续维护和开发的项目。
- 它延续了此前一套同类 CLI 源码恢复与工程整理工作，但当前仓库本身是我自己的持续开发项目。
- 它不是 Anthropic 官方仓库。
- Claude Code、Anthropic 和上游产品标识仍然属于 Anthropic。
