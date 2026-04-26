import { loadConfig, type PortalConfig } from "./config.js";
import { getProvider, listProviders } from "./registry.js";
import type {
  Capabilities,
  CompleteInput,
  CompleteOpts,
  CompleteOutput,
  LlmProvider,
  ProviderName,
} from "./types.js";

export type {
  Capabilities,
  CompleteInput,
  CompleteOpts,
  CompleteOutput,
  FinishReason,
  LlmMessage,
  LlmProvider,
  LlmTool,
  LlmToolCall,
  ProviderName,
} from "./types.js";
export { loadConfig } from "./config.js";
export { getProvider, listProviders } from "./registry.js";

let cachedConfig: PortalConfig | null = null;

function config(): PortalConfig {
  if (!cachedConfig) cachedConfig = loadConfig();
  return cachedConfig;
}

/** Reset the cached config. Used by tests; not part of the runtime contract. */
export function _resetConfigForTests(): void {
  cachedConfig = null;
}

function meetsCapabilities(
  provider: LlmProvider,
  required: Partial<Capabilities> | undefined,
): boolean {
  if (!required) return true;
  for (const [key, value] of Object.entries(required) as [
    keyof Capabilities,
    Capabilities[keyof Capabilities],
  ][]) {
    const actual = provider.capabilities[key];
    if (typeof value === "boolean") {
      if (value && !actual) return false;
    } else if (typeof value === "number") {
      if (typeof actual === "number" && actual < value) return false;
    }
  }
  return true;
}

/**
 * Resolve which provider should serve this call.
 *
 * Order of precedence:
 *   1. opts.provider          — explicit override.
 *   2. config.handlers[opts.handler] — per-handler config.
 *   3. config.defaultProvider — global default.
 *
 * If the resolved provider is unavailable (missing key, etc.) or doesn't meet
 * required capabilities, fall back to "mock" so module load and tests succeed
 * without vendor keys.
 */
export function resolveProvider(opts: CompleteOpts = {}): LlmProvider {
  const cfg = config();
  let chosen: ProviderName;
  if (opts.provider) {
    chosen = opts.provider;
  } else if (opts.handler && cfg.handlers[opts.handler.toLowerCase()]) {
    chosen = cfg.handlers[opts.handler.toLowerCase()]!;
  } else {
    chosen = cfg.defaultProvider;
  }
  const provider = getProvider(chosen);
  if (!provider.isAvailable() || !meetsCapabilities(provider, opts.requireCapabilities)) {
    return getProvider("mock");
  }
  return provider;
}

/**
 * Single entry point for LLM calls in handler code. Handlers must NOT import
 * vendor SDKs directly; route through here. See docs/setup/llm-providers.md
 * and ADR 0010.
 */
export async function complete(
  input: CompleteInput,
  opts: CompleteOpts = {},
): Promise<CompleteOutput> {
  const provider = resolveProvider(opts);
  return provider.complete(input);
}

/**
 * Find the first available provider matching the given capabilities, ignoring
 * config overrides. Useful for diagnostics; handlers should normally use
 * complete() with opts.handler.
 */
export function findCapableProvider(
  required: Partial<Capabilities>,
): LlmProvider | undefined {
  return listProviders().find(
    (p) => p.isAvailable() && meetsCapabilities(p, required),
  );
}
