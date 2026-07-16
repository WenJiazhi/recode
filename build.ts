import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const outdir = "dist";

// Keep the feature set supported by source mode available in packaged builds.
// Additional flags can still be enabled with FEATURE_<NAME>=1 at build time.
const DEFAULT_BUILD_FEATURES = ["TRANSCRIPT_CLASSIFIER", "CHICAGO_MCP", "VOICE_MODE", "BRIDGE_MODE", "KAIROS_BRIEF", "AWAY_SUMMARY", "TOKEN_BUDGET", "PROMPT_CACHE_BREAK_DETECTION", "VERIFICATION_AGENT", "ULTRAPLAN", "AGENT_TRIGGERS", "AGENT_TRIGGERS_REMOTE", "BUILTIN_EXPLORE_PLAN_AGENTS", "EXTRACT_MEMORIES", "LODESTONE", "SHOT_STATS"];
const envFeatures = Object.keys(process.env)
    .filter((key) => key.startsWith("FEATURE_"))
    .map((key) => key.replace("FEATURE_", ""));
const features = [...new Set([...DEFAULT_BUILD_FEATURES, ...envFeatures])];

// Step 1: Clean output directory
const { rmSync } = await import("fs");
rmSync(outdir, { recursive: true, force: true });

// Step 2: Bundle a single-file CLI.
// Bun's split output currently emits duplicate exports for some shared chunks
// in this codebase, which breaks the packaged runtime on startup.
const result = await Bun.build({
    entrypoints: ["src/entrypoints/cli.tsx"],
    outdir,
    target: "bun",
    splitting: false,
    features,
    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
        RECODE_STANDALONE: "false",
        RECODE_EMBEDDED_RIPGREP: "false",
    },
});

if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
        console.error(log);
    }
    process.exit(1);
}

// Step 3: Post-process — replace Bun-only `import.meta.require` with Node.js compatible version
const files = await readdir(outdir);
const IMPORT_META_REQUIRE = "var __require = import.meta.require;";
const COMPAT_REQUIRE = `var __require = typeof import.meta.require === "function" ? import.meta.require : (await import("module")).createRequire(import.meta.url);`;

let patched = 0;
for (const file of files) {
    if (!file.endsWith(".js")) continue;
    const filePath = join(outdir, file);
    const content = await readFile(filePath, "utf-8");
    if (content.includes(IMPORT_META_REQUIRE)) {
        await writeFile(
            filePath,
            content.replace(IMPORT_META_REQUIRE, COMPAT_REQUIRE),
        );
        patched++;
    }
}

console.log(
    `Bundled ${result.outputs.length} files to ${outdir}/ (patched ${patched} for Node.js compat)`,
);
