# recode

[![English](https://img.shields.io/badge/README-English-0ea5e9?style=for-the-badge)](./README.md)
[![简体中文](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-38bdf8?style=for-the-badge)](./README.zh-CN.md)

## Bun + TypeScript 终端编程助手

`recode` 是一个以 Bun + TypeScript 为核心的终端编程助手项目，现在已经作为独立仓库和独立维护线继续推进。它可以更准确地理解为一个面向编程主线的 Claude Code 重建与二次开发项目：保留有价值的 CLI/runtime 结构，修好高价值编程路径，把这棵重建出来的代码树整理成一个真正能日常使用的工具。

当前版本：`0.0.1`

## 项目快照

| 项目 | 数值 |
| --- | --- |
| 版本 | `0.0.1` |
| 运行时 | Bun |
| 语言 | TypeScript |
| 源码文件数（`.ts` / `.tsx`） | `2783` |
| 命令模块数（`src/commands/*`） | `94` |
| 工具模块数（`src/tools/*`） | `55` |
| Workspace 包数量 | `6` |
| 文档文件数（`docs/*.md` / `docs/*.mdx`） | `33` |
| 当前本地测试结果 | `55 pass / 0 fail` |

## 重建进度板

下面这张表就是当前主线首页清单，直接回答三件事：已经做了什么、还没做什么、接下来做什么。

| 模块 | 状态 | 已经完成 | 还没完成 | 下一步 |
| --- | --- | --- | --- | --- |
| CLI 启动与入口 | 可用 | `recode --help`、`recode --version`、源码入口 launcher、构建链路可用 | 打包产物 `dist/cli.js` 还不适合长会话主入口 | 继续以 `src/entrypoints/cli.tsx` 为稳定日常入口 |
| Headless prompt 与 slash commands | 可用 | `/help`、`/status`、`/doctor`、`/files`、`/diff`、`/tasks`、`/review`、`/commit`、`/model-map` 已验证 | 整棵命令树还没全部跑完 | 继续按优先级把高价值命令逐条收口 |
| 交互式 REPL | 可用 | 主 REPL 能启动，核心命令面可进入 | UI 细节和原版体验仍有差距 | 在不破坏主线的前提下继续做 source-faithful 修补 |
| review / commit 工作流 | 部分完成 | `/review` 和 `/commit` 已验证，内建注册已恢复 | `/commit-push-pr` 仍只开放交互态，完整 GitHub 路径还没验完 | 做真实 push/PR 端到端验证 |
| LSP / 代码智能 | 部分完成 | LSP 工具已重新接回，manager 初始化链路已恢复 | 当前环境里仍然发现 `0` 个 LSP server | 接入至少一个真实 server 配置并验证一次真实调用 |
| branch / worktree / git 工作流 | 部分完成 | 分支/worktree 相关命令树在，基础 git 流可用 | 交互式 worktree parity 还没完整验证 | 验证一条真实 branch 路径和一条真实 worktree 路径 |
| MCP / 插件 / agents | 部分完成 | 常用 list/help/management 路径可用 | 深层生命周期兼容还没系统验完 | 继续按高频路径做兼容验证 |
| Provider 路由与配置 | 可用 | 本地 provider 配置、API key 文件、CPA 路由、自定义 `/v1/models`、别名映射都已打通 | 低频 provider 边角路径还没完全收口 | 继续把自定义 provider 和 Anthropic-only 路径隔离清楚 |
| Remote / bridge / voice / workflows | 受限 | 源码树保留 | 这些不是当前最高优先级的编程主线 | 先不打开，等本地 coding loop 稳定后再说 |

## CPA 支持矩阵

这是当前 `recode` 最明确、最有价值的二次开发方向。

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 项目内 provider 配置 | 可用 | 以 `.recode/local-provider.json` 作为主配置入口 |
| 本地 API key 文件 | 可用 | 支持 `.recode/api-key.txt`，且不会进 git |
| provider 类型路由 | 可用 | 通过 `providerType` + `baseURL` 决定实际 provider |
| CPA base URL | 可用 | 当前项目配置支持 `https://cpa.cpapi.app` |
| 自定义 `/v1/models` 发现 | 可用 | 自定义 host 的模型发现和缓存已接通 |
| 三别名映射 | 可用 | `/model-map` 可分别配置 `Opus / Sonnet / Haiku` |
| 思考量后缀透传 | 可用 | `gpt-5.4(high)` 这类 CPA 风格模型名会保留 |
| context cap 持久化 | 可用 | `/model-map context 258k` 会保存 `258000` |
| 便携配置继承 | 可用 | 便携运行时可直接携带本地 `.recode` 目录 |

## 当前已经验证可用

| 领域 | 已验证命令 / 路径 |
| --- | --- |
| CLI | `recode --help`、`recode --version`、`recode -p "<prompt>"` |
| Headless 内建命令 | `recode -p "/help"`、`recode -p "/status"`、`recode -p "/doctor"`、`recode -p "/files"`、`recode -p "/diff"`、`recode -p "/tasks"`、`recode -p "/review"`、`recode -p "/commit"` |
| Headless fallback 提示 | `recode -p "/config"`、`recode -p "/model"`、`recode -p "/commit-push-pr"` |
| 模型映射 | `recode -p "/model-map help"`、`recode -p "/model-map status"`、`recode -p "/model-map context 258k"` |
| 管理面 | `recode auth status`、`recode agents`、`recode mcp --help`、`recode mcp list`、`recode plugin list` |

## 当前冲刺顺序

| 优先级 | 项目 | 为什么它排在前面 |
| --- | --- | --- |
| P1 | LSP 端到端可用性 | 代码智能是当前最缺、但对编程日常价值极高的一块 |
| P2 | branch / worktree parity | 安全的 git 隔离和分支工作流是核心 coding loop 的一部分 |
| P3 | context inspection parity | `/context` 对理解 prompt 压力、工具和 memory 很关键 |
| P4 | 剩余 headless routing 缺口 | 源码在不代表行为对，命令路径要继续收口 |
| P5 | permissions / tool gating 复查 | rebuild 过程中必须保证工具可用性不倒退 |

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
- `bun ./dist/cli.js` 目前主要作为构建验证路径，不建议当长会话主入口

## 仓库文档

| 文档 | 用途 |
| --- | --- |
| [docs/SOURCE_PARITY_CHECKLIST.md](./docs/SOURCE_PARITY_CHECKLIST.md) | 按模块跟踪和源码树的对齐情况 |
| [docs/STATUS.md](./docs/STATUS.md) | 当前验证快照和可用路径 |
| [docs/COMMAND_TOOL_AUDIT.md](./docs/COMMAND_TOOL_AUDIT.md) | 已验证命令和工具覆盖面 |
| [docs/PRIORITY_REBUILD_BACKLOG.md](./docs/PRIORITY_REBUILD_BACKLOG.md) | 从高价值到低价值的重建顺序 |
| [docs/WORKLOG.md](./docs/WORKLOG.md) | 已完成修补工作的实现日志 |
| `docs/archive/` | 存放旧迁移记录，避免继续占据仓库根目录 |

## 致谢

| 项目 | 说明 |
| --- | --- |
| 当前维护 | 当前仓库以 `recode` 名义独立维护 |
| 工程基座 | Bun + TypeScript 工程基座来自此前围绕 Claude Code CLI 的开源逆向和恢复工作，其中包括 `claude-code-best/claude-code` |
| 当前归属 | 当前目录组织、打包方式、CPA 支持、配置流和后续重建方向由本仓库继续维护 |

## 说明

- 这不是 Anthropic 官方仓库。
- 当前仓库的重点是“编程主线优先”的真实重建，不是假装已经完全 parity。
- 首页这些表格会持续保持诚实：什么已经做了，什么还没做，接下来做什么。
