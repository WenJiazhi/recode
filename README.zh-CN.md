# Recode

[![CI](https://github.com/WenJiazhi/recode/actions/workflows/ci.yml/badge.svg)](https://github.com/WenJiazhi/recode/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3.14-black.svg)](https://bun.sh)

[English](./README.md)

Recode 是一个使用 Bun 和 TypeScript 构建的终端编程 Agent。它把流式
Agent 循环、本地开发工具、Provider 路由、MCP、Skills、插件、LSP 和
Worktree 会话整合在一个 CLI 中。

Recode 提供 macOS 和 Linux standalone 二进制，也支持使用 Bun 从源码开发。
`0.0.1` 版本暂不发布 npm 包。

## 主要能力

- 文件、搜索、Shell、Git、任务管理和代码智能工具
- 交互式终端 UI 与非交互 `-p` 模式
- Anthropic、OpenAI 兼容接口、CPA、Bedrock、Vertex、Foundry 路由
- MCP Server、插件、Skills、Hooks 和自定义 Agent
- 会话续接、上下文压缩、记忆和 Git Worktree 隔离
- 带 checkpoint、token 预算和会话恢复的持续 Goal
- 支持取消和恢复的声明式多 Agent DAG 工作流
- 面向编辑器和标准 Agent Client 的 ACP stdio 接入
- 可选的桌面控制集成

## 环境要求

- 所选 Provider 的 API Key 或凭据链
- Git（使用仓库相关工作流时需要）

从源码构建还需要 Bun `1.3.14` 或更高版本。

## 快速开始

下载最新的 macOS 或 Linux Release，并安装到 `~/.local/bin/recode`：

```bash
curl -fsSL https://raw.githubusercontent.com/WenJiazhi/recode/main/install.sh | sh
recode --version
```

安装脚本会自动选择平台与架构、校验 Release 的 SHA-256，并安装 Recode 及其
搜索运行时。可以用 `RECODE_INSTALL_DIR` 修改目录，或用
`RECODE_VERSION=v0.0.1` 固定版本。

也可以从本地仓库构建：

```bash
./scripts/install-local.sh
recode --version
```

从源码启动：

```bash
git clone https://github.com/WenJiazhi/recode.git
cd recode
bun install --frozen-lockfile
bun run dev
```

执行一次非交互请求：

```bash
bun run dev -p "总结这个仓库"
```

构建并检查单文件 CLI：

```bash
bun run build
bun run start --help
```

## Provider 配置

默认情况下，Recode 读取电脑上现有的 `~/.claude/settings.json`，沿用其中的
Provider、Base URL、认证信息和模型映射。`/model` 的选择只作用于当前会话，
下一次启动仍以现有配置为默认值。

Recode 也支持各 SDK 的标准环境变量。项目级 OpenAI 兼容接口或 CPA 路由可以
写入不会提交到 Git 的 `.recode/local-provider.json`。完整模板位于
[.recode/local-provider.example.json](./.recode/local-provider.example.json)。

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

密钥应放在 `.recode/api-key.txt` 或环境变量中。这两个本地配置文件都已加入
`.gitignore`。
`providerType` 支持 `anthropic`、`cpa` 和 `openai`；无效本地配置会在启动时
明确报错，不会被静默忽略。
当前构建只使用 API Key；Anthropic 账号 OAuth 和订阅专属命令已冻结，不会在
CLI 中显示。

## 持续 Goal

对于需要跨多个顶层 Agent 回合的工作，可以使用 `/goal`：

```text
/goal --budget 80k 完成 parser、测试和文档
/goal
/goal checkpoint parser 和单元测试已完成
/goal pause
/goal resume
/goal budget 120k
/goal complete
```

只有当 REPL 空闲、用户队列为空、没有对话框且不在 plan mode 时，
Goal 才会自动续跑。Goal 队列优先级低于用户输入。在 Goal 回合中按
Escape 会暂停；Provider 错误、token 预算和自动续跑上限也会进入
明确的停止状态，不会无限重试。

Goal 状态、token 用量和里程碑 checkpoint 会写入会话 JSONL，并随
`/resume` 恢复。模型可以通过 `Goal` Tool 读取状态、记录 checkpoint 和报告
已验证的完成结果。只有同一原因跨三个连续 Goal 回合都无法解决时，
才能进入 blocked 状态。

命令生命周期和架构说明见
[持续 Goal](./docs/conversation/persistent-goals.mdx)。

## 多 Agent 工作流

任务需要并行调查，再按依赖汇总或实施时，可以使用 `/orchestrate`：

```text
/orchestrate 审查认证流程，只实施经过验证的修复
/workflows
/workflows <run-id>
/workflows stop <run-id>
/workflows resume <run-id>
/workflows concurrency <run-id> <1-6>
/workflows budget <run-id> <tokens|none>
```

Recode 会校验一个有界的声明式 DAG，并行执行互不依赖的只读 worker，把所有
写步骤与其他步骤按依赖顺序串行化，并通过 `/tasks` 展示进度。run 可以设置累计
token 准入预算，并在运行中调整并发；达到预算时已有 worker 会完成，因此并发请求
可能产生有限超出，pending 步骤仍可恢复。已知模型显示本地成本估算；自定义模型或
Provider 缺失 usage 时，成本保持明确的“不完整”状态。每个 run 的 v4 事件 journal
位于不会提交到 Git 的
`.recode/workflow-runs/`；恢复时会复用已完成步骤，只重跑未完成步骤。worker 使用
当前 Provider 和权限链，不能递归启动内置编排工具，也不执行任意工作流脚本。

调度、持久化、安全边界和当前限制见
[声明式多 Agent 工作流](./docs/agent/workflow-orchestration.mdx)。

## ACP 接入

Recode 可以作为标准 Agent Client Protocol stdio Server 运行：

```bash
recode --acp
```

当前支持初始化、新建与加载会话、流式文本与 thinking、工具和计划更新、客户端
权限选择、取消以及基于 JSONL 的恢复。每个 ACP 会话复用 CLI 已有的 Provider、
权限、工具和 stream-json Agent loop，不维护第二套执行引擎。客户端无法无损转发
非文本内容时，Recode 会明确反馈。

协议范围和验证方式见 [ACP stdio 接入](./docs/extensibility/acp.mdx)。

## 代码结构

```text
src/entrypoints/cli.tsx   CLI 启动与 Provider 初始化
src/main.tsx              命令路由和终端应用启动
src/query.ts              流式 Agent 与工具执行循环
src/QueryEngine.ts        多轮非交互会话引擎
src/tools/                内置工具实现
src/commands/             Slash 命令与工作流入口
src/services/             API、MCP、LSP、分析与压缩服务
src/utils/                配置、权限、会话与 Worktree
packages/@recode/         浏览器和桌面控制 Workspace 包
```

架构文档从[什么是 Recode](./docs/introduction/what-is-recode.mdx)开始。
当前产品能力见[能力概览](./docs/introduction/capabilities.mdx)。

## 开发验证

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:provider-e2e
bun run test:acp-e2e
```

测试会让每个测试文件在独立进程中运行，因为 Bun 的模块 Mock 是进程级全局
状态。这样可以避免不同测试文件互相污染，保证全量结果可重复。

开发流程见 [CONTRIBUTING.md](./CONTRIBUTING.md)，安全问题报告方式见
[SECURITY.md](./SECURITY.md)。

## 许可证

项目采用 [Apache License 2.0](./LICENSE)。项目和商标声明见 [NOTICE](./NOTICE)，
第三方依赖继续遵循各自许可证。
