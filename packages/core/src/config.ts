/**
 * Configuration Loading Module
 *
 * Handles loading MDAP configuration from:
 * 1. Config files (.mdaprc, .mdap.json, mdap.config.js)
 * 2. Environment variables (MDAP_*, OPENAI_API_KEY, ANTHROPIC_API_KEY)
 * 3. Runtime overrides
 *
 * Priority: runtime overrides > env vars > config file > defaults
 *
 * @packageDocumentation
 */

import type { Provider, RedFlagInput } from "./execute.js";

/**
 * MDAP configuration structure
 */
export interface MdapConfig {
  /**
   * Default LLM provider
   * @default "openai"
   */
  provider?: Provider;

  /**
   * Default model to use
   * @default "gpt-4.1-mini" for openai, "claude-3-5-haiku-latest" for anthropic
   */
  model?: string;

  /**
   * Default parameters
   */
  defaults?: {
    /**
     * Vote threshold
     * @default 3
     */
    k?: number;

    /**
     * Maximum samples
     * @default 30
     */
    maxSamples?: number;

    /**
     * Temperature
     * @default 0.1
     */
    temperature?: number;

    /**
     * Maximum tokens per response
     * @default 1024
     */
    maxTokens?: number;

    /**
     * Default red flags
     * @default ["tooLong:750", "emptyResponse"]
     */
    redFlags?: RedFlagInput[];
  };
}

/**
 * Resolved configuration with all values filled in
 */
export interface ResolvedConfig {
  provider: Provider;
  model: string;
  k: number;
  maxSamples: number;
  temperature: number;
  maxTokens: number;
  redFlags: RedFlagInput[];
  apiKey?: string;
}

/**
 * Default configuration values (paper-aligned)
 */
const DEFAULT_CONFIG: ResolvedConfig = {
  provider: "openai",
  model: "gpt-4.1-mini",
  k: 3,
  maxSamples: 30,
  temperature: 0.1,
  maxTokens: 1024,
  redFlags: ["tooLong:750", "emptyResponse"],
};

/**
 * Config file names to search for (in order of priority)
 */
const CONFIG_FILE_NAMES = [
  ".mdaprc",
  ".mdaprc.json",
  ".mdap.json",
  "mdap.config.json",
];

/**
 * Load configuration from a JSON file
 */
async function loadJsonConfig(filePath: string): Promise<MdapConfig | null> {
  try {
    // Use dynamic import for JSON (Node.js 18+)
    const fs = await import("fs");
    const path = await import("path");

    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    const content = fs.readFileSync(absolutePath, "utf-8");
    return JSON.parse(content) as MdapConfig;
  } catch {
    return null;
  }
}

/**
 * Search for a config file in the current directory and parent directories
 */
async function findConfigFile(): Promise<MdapConfig | null> {
  try {
    const fs = await import("fs");
    const path = await import("path");

    let currentDir = process.cwd();
    const root = path.parse(currentDir).root;

    // Search up the directory tree
    while (currentDir !== root) {
      for (const fileName of CONFIG_FILE_NAMES) {
        const filePath = path.join(currentDir, fileName);
        if (fs.existsSync(filePath)) {
          const config = await loadJsonConfig(filePath);
          if (config) {
            return config;
          }
        }
      }
      currentDir = path.dirname(currentDir);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): Partial<ResolvedConfig> {
  const config: Partial<ResolvedConfig> = {};

  // Provider
  const provider = process.env.MDAP_PROVIDER;
  if (provider === "openai" || provider === "anthropic") {
    config.provider = provider;
  }

  // Model
  if (process.env.MDAP_MODEL) {
    config.model = process.env.MDAP_MODEL;
  }

  // API Key (based on provider or explicit)
  if (process.env.MDAP_API_KEY) {
    config.apiKey = process.env.MDAP_API_KEY;
  } else if (
    process.env.OPENAI_API_KEY &&
    (!provider || provider === "openai")
  ) {
    config.apiKey = process.env.OPENAI_API_KEY;
  } else if (process.env.ANTHROPIC_API_KEY && provider === "anthropic") {
    config.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  // K value
  if (process.env.MDAP_K) {
    const k = parseInt(process.env.MDAP_K, 10);
    if (!isNaN(k) && k > 0) {
      config.k = k;
    }
  }

  // Max samples
  if (process.env.MDAP_MAX_SAMPLES) {
    const maxSamples = parseInt(process.env.MDAP_MAX_SAMPLES, 10);
    if (!isNaN(maxSamples) && maxSamples > 0) {
      config.maxSamples = maxSamples;
    }
  }

  // Temperature
  if (process.env.MDAP_TEMPERATURE) {
    const temperature = parseFloat(process.env.MDAP_TEMPERATURE);
    if (!isNaN(temperature) && temperature >= 0 && temperature <= 2) {
      config.temperature = temperature;
    }
  }

  // Max tokens
  if (process.env.MDAP_MAX_TOKENS) {
    const maxTokens = parseInt(process.env.MDAP_MAX_TOKENS, 10);
    if (!isNaN(maxTokens) && maxTokens > 0) {
      config.maxTokens = maxTokens;
    }
  }

  return config;
}

/**
 * Merge configuration sources
 */
function mergeConfig(
  base: ResolvedConfig,
  fileConfig: MdapConfig | null,
  envConfig: Partial<ResolvedConfig>,
  overrides?: Partial<ResolvedConfig>,
): ResolvedConfig {
  // Start with defaults
  const result = { ...base };

  // Apply file config
  if (fileConfig) {
    if (fileConfig.provider) result.provider = fileConfig.provider;
    if (fileConfig.model) result.model = fileConfig.model;
    if (fileConfig.defaults) {
      if (fileConfig.defaults.k !== undefined) result.k = fileConfig.defaults.k;
      if (fileConfig.defaults.maxSamples !== undefined)
        result.maxSamples = fileConfig.defaults.maxSamples;
      if (fileConfig.defaults.temperature !== undefined)
        result.temperature = fileConfig.defaults.temperature;
      if (fileConfig.defaults.maxTokens !== undefined)
        result.maxTokens = fileConfig.defaults.maxTokens;
      if (fileConfig.defaults.redFlags !== undefined)
        result.redFlags = fileConfig.defaults.redFlags;
    }
  }

  // Apply env config
  Object.assign(result, envConfig);

  // Apply runtime overrides
  if (overrides) {
    Object.assign(result, overrides);
  }

  // Set default model based on provider if not explicitly set
  if (!fileConfig?.model && !envConfig.model && !overrides?.model) {
    result.model =
      result.provider === "anthropic"
        ? "claude-3-5-haiku-latest"
        : "gpt-4.1-mini";
  }

  return result;
}

/**
 * Load and resolve MDAP configuration
 *
 * Merges configuration from:
 * 1. Default values (paper-aligned)
 * 2. Config file (.mdaprc, .mdap.json, etc.)
 * 3. Environment variables (MDAP_*, OPENAI_API_KEY, etc.)
 * 4. Runtime overrides (passed as argument)
 *
 * @example
 * ```typescript
 * // Load config with all defaults
 * const config = await loadConfig();
 *
 * // Load config with runtime overrides
 * const config = await loadConfig({ k: 5, provider: "anthropic" });
 * ```
 */
export async function loadConfig(
  overrides?: Partial<ResolvedConfig>,
): Promise<ResolvedConfig> {
  const fileConfig = await findConfigFile();
  const envConfig = loadEnvConfig();

  return mergeConfig(DEFAULT_CONFIG, fileConfig, envConfig, overrides);
}

/**
 * Get the default configuration (paper-aligned)
 */
export function getDefaultConfig(): ResolvedConfig {
  return { ...DEFAULT_CONFIG };
}

/**
 * Validate a configuration object
 */
export function validateConfig(config: Partial<ResolvedConfig>): string[] {
  const errors: string[] = [];

  if (config.k !== undefined && (config.k < 1 || !Number.isInteger(config.k))) {
    errors.push("k must be a positive integer");
  }

  if (
    config.maxSamples !== undefined &&
    (config.maxSamples < 1 || !Number.isInteger(config.maxSamples))
  ) {
    errors.push("maxSamples must be a positive integer");
  }

  if (
    config.temperature !== undefined &&
    (config.temperature < 0 || config.temperature > 2)
  ) {
    errors.push("temperature must be between 0 and 2");
  }

  if (
    config.maxTokens !== undefined &&
    (config.maxTokens < 1 || !Number.isInteger(config.maxTokens))
  ) {
    errors.push("maxTokens must be a positive integer");
  }

  if (
    config.provider !== undefined &&
    config.provider !== "openai" &&
    config.provider !== "anthropic"
  ) {
    errors.push('provider must be "openai" or "anthropic"');
  }

  return errors;
}
