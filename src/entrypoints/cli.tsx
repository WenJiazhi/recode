#!/usr/bin/env bun
// Runtime polyfill for bun:bundle (build-time macros)
import { homedir } from "os";
import { join } from "path";
import { ANTHROPIC_ACCOUNT_AUTH_ENABLED } from "../constants/capabilities.js";
import { isEnvTruthy } from "../utils/envUtils.js";

const feature = (_name: string) => false;
if (typeof globalThis.MACRO === "undefined") {
    (globalThis as any).MACRO = {
        VERSION: "0.0.1",
        BUILD_TIME: new Date().toISOString(),
        FEEDBACK_CHANNEL: "",
        ISSUES_EXPLAINER: "",
        NATIVE_PACKAGE_URL: "",
        PACKAGE_URL: "",
        VERSION_CHANGELOG: "",
    };
}
// Build-time constants — normally replaced by Bun bundler at compile time
(globalThis as any).BUILD_TARGET = "external";
(globalThis as any).BUILD_ENV = "production";
(globalThis as any).INTERFACE_TYPE = "stdio";

// Recode uses its own plugin cache so it doesn't inherit user-installed Claude
// plugins and hooks from ~/.claude/plugins by default. Keep the main config
// directory unchanged for now so existing API/model settings still work.
if (!process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR) {
    process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR = join(
        homedir(),
        ".recode",
        "plugins",
    );
}

// Keep brief mode available in source-runtime external builds.
process.env.FEATURE_KAIROS_BRIEF ??= "1";
// Keep away-summary available in source-runtime external builds.
process.env.FEATURE_AWAY_SUMMARY ??= "1";
// Keep token-budget available in source-runtime external builds.
process.env.FEATURE_TOKEN_BUDGET ??= "1";
// Keep prompt-cache-break detection available in source-runtime external builds.
process.env.FEATURE_PROMPT_CACHE_BREAK_DETECTION ??= "1";
// Keep verification-agent available in source-runtime external builds.
process.env.FEATURE_VERIFICATION_AGENT ??= "1";
// Keep agent triggers and built-in explore/plan agents available in source mode.
process.env.FEATURE_AGENT_TRIGGERS ??= "1";
process.env.FEATURE_BUILTIN_EXPLORE_PLAN_AGENTS ??= "1";
process.env.FEATURE_EXTRACT_MEMORIES ??= "1";
process.env.FEATURE_LODESTONE ??= "1";
process.env.FEATURE_SHOT_STATS ??= "1";
// Keep CHICAGO_MCP available in source-runtime external builds.
process.env.FEATURE_CHICAGO_MCP ??= "1";
// Bugfix for corepack auto-pinning, which adds yarnpkg to peoples' package.jsons
// eslint-disable-next-line custom-rules/no-top-level-side-effects
process.env.COREPACK_ENABLE_AUTO_PIN = "0";

// Set max heap size for child processes in CCR environments (containers have 16GB)
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level, custom-rules/safe-env-boolean-check
if (process.env.CLAUDE_CODE_REMOTE === "true") {
    // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
    const existing = process.env.NODE_OPTIONS || "";
    // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
    process.env.NODE_OPTIONS = existing
        ? `${existing} --max-old-space-size=8192`
        : "--max-old-space-size=8192";
}

// Harness-science L0 ablation baseline. Inlined here (not init.ts) because
// BashTool/AgentTool/PowerShellTool capture DISABLE_BACKGROUND_TASKS into
// module-level consts at import time — init() runs too late. feature() gate
// DCEs this entire block from external builds.
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (feature("ABLATION_BASELINE") && process.env.CLAUDE_CODE_ABLATION_BASELINE) {
    for (const k of [
        "CLAUDE_CODE_SIMPLE",
        "CLAUDE_CODE_DISABLE_THINKING",
        "DISABLE_INTERLEAVED_THINKING",
        "DISABLE_COMPACT",
        "DISABLE_AUTO_COMPACT",
        "CLAUDE_CODE_DISABLE_AUTO_MEMORY",
        "CLAUDE_CODE_DISABLE_BACKGROUND_TASKS",
    ]) {
        // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
        process.env[k] ??= "1";
    }
}

/**
 * Bootstrap entrypoint - checks for special flags before loading the full CLI.
 * All imports are dynamic to minimize module evaluation for fast paths.
 * Fast-path for --version has zero imports beyond this file.
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    const frozenAccountEntrypoints = new Set([
        "auth",
        "setup-token",
        "remote-control",
        "rc",
        "remote",
        "sync",
        "bridge",
        "assistant",
    ]);
    if (
        !ANTHROPIC_ACCOUNT_AUTH_ENABLED &&
        args[0] &&
        frozenAccountEntrypoints.has(args[0])
    ) {
        console.error(
            `[recode] ${args[0]} is not available in the API-key-only build.`,
        );
        process.exitCode = 1;
        return;
    }

    // Fast-path for --version/-v: zero module loading needed
    if (
        args.length === 1 &&
        (args[0] === "--version" || args[0] === "-v" || args[0] === "-V")
    ) {
        // MACRO.VERSION is inlined at build time
        console.log(`${MACRO.VERSION} (recode)`);
        return;
    }

    // ACP owns stdout as a JSON-RPC channel, so enter before provider setup,
    // profiling, Commander, or the TUI can emit user-facing output.
    if (args.length === 1 && args[0] === "--acp") {
        const { runAcpServer } = await import("../acp/server.js");
        await runAcpServer();
        return;
    }

    const { applyLocalProviderConfig } = await import(
        "../utils/localProviderConfig.js",
    );
    const providerConfig = applyLocalProviderConfig();
    if (providerConfig.error) {
        console.error(`[recode] ${providerConfig.error}`);
        process.exitCode = 1;
        return;
    }

    // For all other paths, load the startup profiler
    const { profileCheckpoint } = await import("../utils/startupProfiler.js");
    profileCheckpoint("cli_entry");

    // Fast-path for --dump-system-prompt: output the rendered system prompt and exit.
    // Used by prompt sensitivity evals to extract the system prompt at a specific commit.
    // Ant-only: eliminated from external builds via feature flag.
    if (feature("DUMP_SYSTEM_PROMPT") && args[0] === "--dump-system-prompt") {
        profileCheckpoint("cli_dump_system_prompt_path");
        const { enableConfigs } = await import("../utils/config.js");
        enableConfigs();
        const { getMainLoopModel } = await import("../utils/model/model.js");
        const modelIdx = args.indexOf("--model");
        const model =
            (modelIdx !== -1 && args[modelIdx + 1]) || getMainLoopModel();
        const { getSystemPrompt } = await import("../constants/prompts.js");
        const prompt = await getSystemPrompt([], model);
        console.log(prompt.join("\n"));
        return;
    }
    if (
        ANTHROPIC_ACCOUNT_AUTH_ENABLED &&
        process.argv[2] === "--claude-in-chrome-mcp"
    ) {
        profileCheckpoint("cli_claude_in_chrome_mcp_path");
        const { runClaudeInChromeMcpServer } =
            await import("../utils/claudeInChrome/mcpServer.js");
        await runClaudeInChromeMcpServer();
        return;
    } else if (
        ANTHROPIC_ACCOUNT_AUTH_ENABLED &&
        process.argv[2] === "--chrome-native-host"
    ) {
        profileCheckpoint("cli_chrome_native_host_path");
        const { runChromeNativeHost } =
            await import("../utils/claudeInChrome/chromeNativeHost.js");
        await runChromeNativeHost();
        return;
    } else if (
        (feature("CHICAGO_MCP") || isEnvTruthy(process.env.FEATURE_CHICAGO_MCP)) &&
        process.argv[2] === "--computer-use-mcp"
    ) {
        profileCheckpoint("cli_computer_use_mcp_path");
        const { runComputerUseMcpServer } =
            await import("../utils/computerUse/mcpServer.js");
        await runComputerUseMcpServer();
        return;
    }

    // Fast-path for `--daemon-worker=<kind>` (internal — supervisor spawns this).
    // Must come before the daemon subcommand check: spawned per-worker, so
    // perf-sensitive. No enableConfigs(), no analytics sinks at this layer —
    // workers are lean. If a worker kind needs configs/auth (assistant will),
    // it calls them inside its run() fn.
    if (feature("DAEMON") && args[0] === "--daemon-worker") {
        const { runDaemonWorker } = await import("../daemon/workerRegistry.js");
        await runDaemonWorker(args[1]);
        return;
    }

    // Fast-path for `claude remote-control` (also accepts legacy `claude remote` / `claude sync` / `claude bridge`):
    // serve local machine as bridge environment.
    // Bridge is not default-enabled for external builds, but source-first runs
    // should still honor an explicit FEATURE_BRIDGE_MODE opt-in so local
    // testing can mirror a feature-enabled build.
    if (
        ANTHROPIC_ACCOUNT_AUTH_ENABLED &&
        (feature("BRIDGE_MODE") || isEnvTruthy(process.env.FEATURE_BRIDGE_MODE)) &&
        (args[0] === "remote-control" ||
            args[0] === "rc" ||
            args[0] === "remote" ||
            args[0] === "sync" ||
            args[0] === "bridge")
    ) {
        profileCheckpoint("cli_bridge_path");
        const { enableConfigs } = await import("../utils/config.js");
        enableConfigs();
        const { getBridgeDisabledReason, checkBridgeMinVersion } =
            await import("../bridge/bridgeEnabled.js");
        const { BRIDGE_LOGIN_ERROR } = await import("../bridge/types.js");
        const { bridgeMain } = await import("../bridge/bridgeMain.js");
        const { exitWithError } = await import("../utils/process.js");

        // Auth check must come before the GrowthBook gate check — without auth,
        // GrowthBook has no user context and would return a stale/default false.
        // getBridgeDisabledReason awaits GB init, so the returned value is fresh
        // (not the stale disk cache), but init still needs auth headers to work.
        const { getClaudeAIOAuthTokens } = await import("../utils/auth.js");
        if (!getClaudeAIOAuthTokens()?.accessToken) {
            exitWithError(BRIDGE_LOGIN_ERROR);
        }
        const disabledReason = await getBridgeDisabledReason();
        if (disabledReason) {
            exitWithError(`Error: ${disabledReason}`);
        }
        const versionError = checkBridgeMinVersion();
        if (versionError) {
            exitWithError(versionError);
        }

        // Bridge is a remote control feature - check policy limits
        const { waitForPolicyLimitsToLoad, isPolicyAllowed } =
            await import("../services/policyLimits/index.js");
        await waitForPolicyLimitsToLoad();
        if (!isPolicyAllowed("allow_remote_control")) {
            exitWithError(
                "Error: Remote Control is disabled by your organization's policy.",
            );
        }
        await bridgeMain(args.slice(1));
        return;
    }

    // Fast-path for `claude daemon [subcommand]`: long-running supervisor.
    if (feature("DAEMON") && args[0] === "daemon") {
        profileCheckpoint("cli_daemon_path");
        const { enableConfigs } = await import("../utils/config.js");
        enableConfigs();
        const { initSinks } = await import("../utils/sinks.js");
        initSinks();
        const { daemonMain } = await import("../daemon/main.js");
        await daemonMain(args.slice(1));
        return;
    }

    // Fast-path for `claude ps|logs|attach|kill` and `--bg`/`--background`.
    // Session management against the ~/.claude/sessions/ registry. Flag
    // literals are inlined so bg.js only loads when actually dispatching.
    if (
        feature("BG_SESSIONS") &&
        (args[0] === "ps" ||
            args[0] === "logs" ||
            args[0] === "attach" ||
            args[0] === "kill" ||
            args.includes("--bg") ||
            args.includes("--background"))
    ) {
        profileCheckpoint("cli_bg_path");
        const { enableConfigs } = await import("../utils/config.js");
        enableConfigs();
        const bg = await import("../cli/bg.js");
        switch (args[0]) {
            case "ps":
                await bg.psHandler(args.slice(1));
                break;
            case "logs":
                await bg.logsHandler(args[1]);
                break;
            case "attach":
                await bg.attachHandler(args[1]);
                break;
            case "kill":
                await bg.killHandler(args[1]);
                break;
            default:
                await bg.handleBgFlag(args);
        }
        return;
    }

    // Fast-path for template job commands.
    if (
        feature("TEMPLATES") &&
        (args[0] === "new" || args[0] === "list" || args[0] === "reply")
    ) {
        profileCheckpoint("cli_templates_path");
        const { templatesMain } =
            await import("../cli/handlers/templateJobs.js");
        await templatesMain(args);
        // process.exit (not return) — mountFleetView's Ink TUI can leave event
        // loop handles that prevent natural exit.
        // eslint-disable-next-line custom-rules/no-process-exit
        process.exit(0);
    }

    // Fast-path for `claude environment-runner`: headless BYOC runner.
    // feature() must stay inline for build-time dead code elimination.
    if (
        feature("BYOC_ENVIRONMENT_RUNNER") &&
        args[0] === "environment-runner"
    ) {
        profileCheckpoint("cli_environment_runner_path");
        const { environmentRunnerMain } =
            await import("../environment-runner/main.js");
        await environmentRunnerMain(args.slice(1));
        return;
    }

    // Fast-path for `claude self-hosted-runner`: headless self-hosted-runner
    // targeting the SelfHostedRunnerWorkerService API (register + poll; poll IS
    // heartbeat). feature() must stay inline for build-time dead code elimination.
    if (feature("SELF_HOSTED_RUNNER") && args[0] === "self-hosted-runner") {
        profileCheckpoint("cli_self_hosted_runner_path");
        const { selfHostedRunnerMain } =
            await import("../self-hosted-runner/main.js");
        await selfHostedRunnerMain(args.slice(1));
        return;
    }

    // Fast-path for --worktree --tmux: exec into tmux before loading full CLI
    const hasTmuxFlag =
        args.includes("--tmux") || args.includes("--tmux=classic");
    if (
        hasTmuxFlag &&
        (args.includes("-w") ||
            args.includes("--worktree") ||
            args.some((a) => a.startsWith("--worktree=")))
    ) {
        profileCheckpoint("cli_tmux_worktree_fast_path");
        const { enableConfigs } = await import("../utils/config.js");
        enableConfigs();
        const { isWorktreeModeEnabled } =
            await import("../utils/worktreeModeEnabled.js");
        if (isWorktreeModeEnabled()) {
            const { execIntoTmuxWorktree } =
                await import("../utils/worktree.js");
            const result = await execIntoTmuxWorktree(args);
            if (result.handled) {
                return;
            }
            // If not handled (e.g., error), fall through to normal CLI
            if (result.error) {
                const { exitWithError } = await import("../utils/process.js");
                exitWithError(result.error);
            }
        }
    }

    // Redirect common update flag mistakes to the update subcommand
    if (
        args.length === 1 &&
        (args[0] === "--update" || args[0] === "--upgrade")
    ) {
        process.argv = [process.argv[0]!, process.argv[1]!, "update"];
    }

    // --bare: set SIMPLE early so gates fire during module eval / commander
    // option building (not just inside the action handler).
    if (args.includes("--bare")) {
        process.env.CLAUDE_CODE_SIMPLE = "1";
    }

    // No special flags detected, load and run the full CLI
    const { startCapturingEarlyInput } = await import("../utils/earlyInput.js");
    startCapturingEarlyInput();
    profileCheckpoint("cli_before_main_import");
    const { main: cliMain } = await import("../main.jsx");
    profileCheckpoint("cli_after_main_import");
    await cliMain();
    profileCheckpoint("cli_after_main_complete");
}

// eslint-disable-next-line custom-rules/no-top-level-side-effects
void main();
