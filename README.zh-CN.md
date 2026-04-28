# recode

[![English](https://img.shields.io/badge/README-English-0ea5e9?style=for-the-badge)](./README.md)
[![简体中文](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-38bdf8?style=for-the-badge)](./README.zh-CN.md)

## Bun + TypeScript 终端编程助手

`recode` 是一个以 Bun + TypeScript 为核心的终端编程助手项目，当前作为独立仓库和独立维护线继续推进。现在的目标仍然很明确：把 Claude Code / CCB 这条基座里真正有价值的编程能力重新拼起来、修稳、验证清楚，然后只合并那些有意义的上游切片，而不是再造一套新的臃肿产品面。

当前版本：`0.0.1`

## 项目快照

| 项目 | 数值 |
| --- | --- |
| 版本 | `0.0.1` |
| 运行时 | Bun |
| 语言 | TypeScript |
| 源码文件数（`src/**/*.ts,tsx`） | `2850` |
| 命令模块数（`src/commands/*`） | `95` |
| 工具模块数（`src/tools/*`） | `55` |
| Workspace 包数量 | `6` |
| 文档文件数（`docs/*.md` / `docs/*.mdx`） | `34` |
| 当前本地测试结果 | `218 pass / 0 fail` |
| 当前 lint 快照 | `clean / 0 blocking errors` |

## 重建进度板

| 模块 | 状态 | 已完成 | 剩余问题 | 下一步 |
| --- | --- | --- | --- | --- |
| CLI 启动与入口 | 就绪 | `recode --help`、`--version`、源码入口、打包入口、仓库外 cwd 启动都正常 | `dist/cli.js` 仍不适合超长会话主入口 | 继续把 source-first 入口作为日常入口 |
| Headless 命令与 prompt 主链 | 就绪 | `/help`、`/status`、`/doctor`、`/files`、`/diff`、`/tasks`、`/context`、`/review`、`/commit`、`/model-map`、`/brief`、`/voice`、`/chrome`、`/ultraplan`、`/remote-control` 都已正确分流 | 低频命令还可以继续抽查 | 继续保持命令面可预测 |
| 交互式 REPL | 可用 | 核心 REPL、设置页、auto 模式、主要命令入口都已可用 | 低频 UI 细节还不如原版 | 继续做 source-faithful 的小修补，不重写交互模型 |
| Review / Commit 工作流 | 部分完成 | prompt 生成、shell 占位符展开、headless fallback 都已验证 | 更深的交互式 GitHub 发布链仍保持保守 | 在不碰远端副作用的前提下继续验证 |
| LSP / 代码智能 | 部分完成 | `.recode/lsp.json`、manager 路由、推荐链、诊断、真实 definition 请求链都已接通并有回归 | 日常使用仍然依赖用户本机有真实 LSP server | 继续把首条成功配置路径做得更清楚 |
| Branch / Worktree / Session 连续性 | 部分完成 | create/cleanup/dirty detection、`.worktreeinclude`、keep/reuse、agent worktree、resume continuity、permission round-trip 都已回归覆盖 | 更深的交互态 parity 仍值得继续验证 | 继续补互动链，不放松安全边界 |
| Provider 路由与 CPA 支持 | 就绪 | 本地 provider 配置、key 文件、CPA 路由、自定义 `/v1/models`、别名映射都已打通 | 低频 provider 边角还没完全收干净 | 继续把自定义 provider 和 Anthropic-only 路径隔离清楚 |
| CCB 功能对齐 | 就绪 | 1–16 项高价值对齐项已完成：OpenAI tool-calling、local gates、`[local]` 标签、interview shim、ultraplan、voice、bridge、computer-use/chrome-use、brief、away-summary、token-budget、prompt-cache-break、verification-agent、agent-triggers / explore-plan gate、extract-memories / Lodestone、shot-stats | 现在剩下的是合并后的收口，不是缺功能切片 | 继续做 source-faithful 验证与清理 |
| Windows computer-use / chrome-use | 部分完成 | cross-platform executor、input/swift backends、真实 MCP 包、`open_terminal` fallback、终端 `request_access`、`bind_window` 的仓库内 smoke 都已打通 | 仓库外的桌面壳层仍可能有问题 | 继续收 Windows 终端/窗口集成链，不重造 runtime |

## CCB 对齐清单

| 顺序 | 项目 | 状态 |
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

## CPA 支持矩阵

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 项目内 provider 配置 | 就绪 | `.recode/local-provider.json` 是主路由入口 |
| 本地 API key 文件 | 就绪 | `.recode/api-key.txt` 不进 git |
| provider 类型路由 | 就绪 | `providerType` + `baseURL` 决定实际 provider |
| CPA base URL | 就绪 | 当前项目流支持 `https://cpa.cpapi.app` |
| 自定义 `/v1/models` 发现 | 就绪 | 自定义 host 模型发现和能力缓存已打通 |
| 三别名映射 | 就绪 | `/model-map` 可单独配置 `Opus / Sonnet / Haiku` |
| 思考量后缀透传 | 就绪 | `gpt-5.4(high)` 这类名字会保留 |
| context cap 持久化 | 就绪 | `/model-map context 258k` 会保存 `258000` |
| CPA GPT-5 下的 auto 模式 | 就绪 | CPA / OpenAI GPT-5 路线不再被旧的 Claude-only auto gate 挡住 |
| 项目内 LSP 配置 | 就绪 | `.recode/lsp.json` 已是正式本地 server 入口 |

## 当前已验证可用

| 领域 | 已验证命令 / 路径 |
| --- | --- |
| CLI | `recode --help`、`recode --version`、`recode -p "<prompt>"` |
| Headless 内建命令 | `recode -p "/help"`、`"/status"`、`"/doctor"`、`"/files"`、`"/diff"`、`"/tasks"`、`"/context"`、`"/review"`、`"/commit"` |
| 交互命令 fallback | `"/config"`、`"/model"`、`"/branch"`、`"/compact"`、`"/init"`、`"/commit-push-pr"`、`"/brief"`、`"/voice"`、`"/chrome"`、`"/ultraplan"`、`"/remote-control"` |
| 模型与 auto 模式 | `recode --permission-mode auto -p "hi"`、`recode auto-mode defaults`、`recode -p "/model-map status"` |
| Provider / CPA | 真实 CPA `-p` 请求、项目内 provider 加载、`/model-map context 258k` |
| LSP | `.recode/lsp.json`、`/doctor`、`/status`、推荐链、错误提示、真实 definition 请求链 |
| MCP / plugins / agents | `recode auth status`、`recode agents`、`recode mcp --help`、`recode mcp list`、`recode plugin list` |
| Windows computer-use | `--computer-use-mcp`、`open_terminal`、终端 `request_access`、`bind_window` 仓库内 smoke |

## 当前冲刺顺序

| 优先级 | 项目 | 为什么现在做 |
| --- | --- | --- |
| P1 | 进度表重整与剩余 lint 清理 | 主线已经是绿的，现在最高价值是把维护噪音继续压下去，并让状态表保持真实 |
| P2 | Windows 桌面控制收口 | 仓库内主链已经明显变好，剩下的真实摩擦主要在终端/窗口集成 |
| P3 | Review / Commit / Branch / Worktree 交互验证 | coding 主链已经在，但更深的交互态验证仍然有价值 |
| P4 | 低频品牌和文案清理 | 重要，但优先级低于稳定性和可维护性 |

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

直接从仓库启动：

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

- 日常本地使用优先走 `.\recode.cmd` 或 `recode`
- `bun ./dist/cli.js` 目前主要作为构建验证路径，不建议作为超长会话主入口

## 仓库文档

| 文档 | 用途 |
| --- | --- |
| [docs/SOURCE_PARITY_CHECKLIST.md](./docs/SOURCE_PARITY_CHECKLIST.md) | 与恢复后源码树的对齐情况 |
| [docs/STATUS.md](./docs/STATUS.md) | 当前验证快照与可用路径 |
| [docs/CCB_MERGE_PLAN.md](./docs/CCB_MERGE_PLAN.md) | 当前 CCB 对齐台账与合并后剩余差距 |
| [docs/PRIORITY_REBUILD_BACKLOG.md](./docs/PRIORITY_REBUILD_BACKLOG.md) | 还值得继续做的高价值事项 |
| [docs/COMMAND_TOOL_AUDIT.md](./docs/COMMAND_TOOL_AUDIT.md) | 已验证命令与工具覆盖面 |
| [docs/WORKLOG.md](./docs/WORKLOG.md) | 已完成修补工作的实现日志 |
| `.recode/lsp.example.json` | 项目内 LSP server 配置示例 |

## 致谢

| 项目 | 说明 |
| --- | --- |
| 当前维护 | 当前仓库以 `recode` 名义独立维护 |
| 工程基座 | Bun + TypeScript 工程基座来自围绕 Claude Code CLI 的开源逆向和恢复工作，其中包括 `claude-code-best/claude-code` |
| 当前归属 | 当前目录结构、打包方式、CPA 支持、配置流和后续重建方向由本仓库继续维护 |

## 说明

- 这不是 Anthropic 官方仓库。
- 当前方向依然是“原始能力拼接 + 编程主线优先”，不是为了做大而大的功能堆积。
- 上面的表格会持续保持诚实：什么已经做了，什么还没做，下一步要做什么。
