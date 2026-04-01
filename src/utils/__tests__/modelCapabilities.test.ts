import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
	resetStateForTests,
	setCustomModelAliasMappings,
} from "../../bootstrap/state";
import { modelSupportsEffort } from "../effort";
import {
	getDefaultHaikuModel,
	getDefaultOpusModel,
	getDefaultSonnetModel,
	parseUserSpecifiedModel,
} from "../model/model";
import { getModelOptions } from "../model/modelOptions";
import { getModelCapability } from "../model/modelCapabilities";
import { modelSupportsThinking } from "../thinking";
import { resetSettingsCache } from "../settings/settingsCache";

const envSnapshot = {
	anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL,
	claudeConfigDir: process.env.CLAUDE_CONFIG_DIR,
	claudeCodeUseBedrock: process.env.CLAUDE_CODE_USE_BEDROCK,
	claudeCodeUseVertex: process.env.CLAUDE_CODE_USE_VERTEX,
	claudeCodeUseFoundry: process.env.CLAUDE_CODE_USE_FOUNDRY,
};

const tempDirs: string[] = [];

afterEach(() => {
	process.env.ANTHROPIC_BASE_URL = envSnapshot.anthropicBaseUrl;
	process.env.CLAUDE_CONFIG_DIR = envSnapshot.claudeConfigDir;
	process.env.CLAUDE_CODE_USE_BEDROCK = envSnapshot.claudeCodeUseBedrock;
	process.env.CLAUDE_CODE_USE_VERTEX = envSnapshot.claudeCodeUseVertex;
	process.env.CLAUDE_CODE_USE_FOUNDRY = envSnapshot.claudeCodeUseFoundry;

	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { force: true, recursive: true });
	}

	resetStateForTests();
	resetSettingsCache();
});

function writeCapabilityCache(models: unknown[]): string {
	const dir = mkdtempSync(join(tmpdir(), "recode-model-capabilities-"));
	const cacheDir = join(dir, "cache");
	mkdirSync(cacheDir, { recursive: true });
	writeFileSync(
		join(cacheDir, "model-capabilities.json"),
		JSON.stringify({ models, timestamp: Date.now() }),
		"utf8",
	);
	tempDirs.push(dir);
	return dir;
}

function writeUserSettings(settings: unknown): string {
	const dir = mkdtempSync(join(tmpdir(), "recode-model-settings-"));
	writeFileSync(join(dir, "settings.json"), JSON.stringify(settings), "utf8");
	tempDirs.push(dir);
	return dir;
}

describe("custom base URL model capabilities", () => {
	test("loads cached capabilities for custom first-party hosts", () => {
		const configDir = writeCapabilityCache([
			{
				id: "claude-sonnet-4.5-cpa",
				max_input_tokens: 400000,
				max_tokens: 64000,
				supports_thinking: true,
				supports_effort: true,
			},
			{
				id: "claude-haiku-legacy-cpa",
				supports_thinking: false,
				supports_effort: false,
			},
		]);

		process.env.CLAUDE_CONFIG_DIR = configDir;
		process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:40124";
		delete process.env.CLAUDE_CODE_USE_BEDROCK;
		delete process.env.CLAUDE_CODE_USE_VERTEX;
		delete process.env.CLAUDE_CODE_USE_FOUNDRY;

		expect(getModelCapability("claude-sonnet-4.5-cpa")).toEqual({
			id: "claude-sonnet-4.5-cpa",
			max_input_tokens: 400000,
			max_tokens: 64000,
			supports_thinking: true,
			supports_effort: true,
		});
		expect(modelSupportsThinking("claude-sonnet-4.5-cpa")).toBe(true);
		expect(modelSupportsEffort("claude-sonnet-4.5-cpa")).toBe(true);
		expect(modelSupportsThinking("claude-haiku-legacy-cpa")).toBe(false);
		expect(modelSupportsEffort("claude-haiku-legacy-cpa")).toBe(false);
	});

	test("custom host auto mappings drive defaults without replacing alias picker labels", () => {
		process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:40124";
		process.env.CLAUDE_CONFIG_DIR = writeUserSettings({});
		delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
		delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL;
		delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
		resetSettingsCache();

		setCustomModelAliasMappings({
			sonnet: {
				value: "router-sonnet-pro",
				label: "Router Sonnet Pro",
				description: "mapped sonnet",
			},
			opus: {
				value: "router-opus-max",
				label: "Router Opus Max",
				description: "mapped opus",
			},
			haiku: {
				value: "router-haiku-fast",
				label: "Router Haiku Fast",
				description: "mapped haiku",
			},
		});

		expect(getDefaultSonnetModel()).toBe("router-sonnet-pro");
		expect(getDefaultOpusModel()).toBe("router-opus-max");
		expect(getDefaultHaikuModel()).toBe("router-haiku-fast");
		expect(parseUserSpecifiedModel("sonnet")).toBe("router-sonnet-pro");
		expect(parseUserSpecifiedModel("opus")).toBe("router-opus-max");
		expect(parseUserSpecifiedModel("haiku")).toBe("router-haiku-fast");

		const pickerLabels = getModelOptions().map((option) => option.label);

		expect(pickerLabels).not.toContain("Router Sonnet Pro");
		expect(pickerLabels).not.toContain("Router Opus Max");
		expect(pickerLabels).not.toContain("Router Haiku Fast");
		expect(pickerLabels).toContain("Haiku");
	});

	test("persisted custom alias mappings override auto mappings and append thinking suffixes", () => {
		process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:40124";
		process.env.CLAUDE_CONFIG_DIR = writeUserSettings({
			customModelAliasMappings: {
				opus: { model: "router-opus-max", thinking: "xhigh" },
				sonnet: { model: "router-sonnet-pro", thinking: "high" },
				haiku: { model: "router-haiku-fast", thinking: "low" },
			},
		});
		delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
		delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL;
		delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
		resetSettingsCache();

		expect(getDefaultSonnetModel()).toBe("router-sonnet-pro(high)");
		expect(getDefaultOpusModel()).toBe("router-opus-max(xhigh)");
		expect(getDefaultHaikuModel()).toBe("router-haiku-fast(low)");
		expect(parseUserSpecifiedModel("sonnet")).toBe("router-sonnet-pro(high)");
		expect(parseUserSpecifiedModel("opus")).toBe("router-opus-max(xhigh)");
		expect(parseUserSpecifiedModel("haiku")).toBe("router-haiku-fast(low)");
	});
});
