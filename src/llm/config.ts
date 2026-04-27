import type { ProviderName } from "./types.js";

const VALID_PROVIDERS: readonly ProviderName[] = [
  "openai",
  "anthropic",
  "grok",
  "v0",
  "local",
  "mock",
] as const;

export interface PortalConfig {
  /** Default provider when no handler-specific override matches. */
  defaultProvider: ProviderName;
  /** Per-handler overrides. Key is the logical handler name passed to complete(). */
  handlers: Record<string, ProviderName>;
}

function isProviderName(value: string): value is ProviderName {
  return (VALID_PROVIDERS as readonly string[]).includes(value);
}

/** Normalize a handler name for lookup: lowercase, with underscores and dashes
 * stripped. So `LLM_HANDLER_ISSUES_AI`, `LLM_HANDLER_ISSUESAI`, and a caller
 * passing `handler: "issues_ai"` or `handler: "issuesAi"` all resolve to the
 * same key. Keep both sides of the lookup (config build + resolveProvider) in
 * sync via this helper. */
export function normalizeHandlerName(name: string): string {
  return name.toLowerCase().replace(/[_-]/g, "");
}

/**
 * Resolve the portal config from environment variables.
 *
 * Recognized env vars:
 * - LLM_DEFAULT_PROVIDER — global default (e.g. "openai", "anthropic", "mock").
 * - LLM_HANDLER_<NAME>   — per-handler override (e.g. LLM_HANDLER_ISSUESAI=anthropic).
 *                          Underscores and dashes in <NAME> are stripped at lookup
 *                          time, so LLM_HANDLER_ISSUES_AI matches a caller passing
 *                          `handler: "issuesai"` (or vice versa).
 *
 * If LLM_DEFAULT_PROVIDER is unset, the default is "mock" so module load and
 * tests succeed without any vendor key. Adapters self-report availability via
 * isAvailable(); the portal falls back to mock when the configured adapter is
 * unavailable.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): PortalConfig {
  const rawDefault = env.LLM_DEFAULT_PROVIDER?.trim().toLowerCase();
  let defaultProvider: ProviderName = "mock";
  if (rawDefault) {
    if (isProviderName(rawDefault)) {
      defaultProvider = rawDefault;
    } else {
      console.warn(
        `[llm portal] Ignoring LLM_DEFAULT_PROVIDER=${JSON.stringify(env.LLM_DEFAULT_PROVIDER)} ` +
          `— not a known provider name (${VALID_PROVIDERS.join(", ")}). ` +
          `Falling back to "mock".`,
      );
    }
  }

  const handlers: Record<string, ProviderName> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("LLM_HANDLER_") || !value) continue;
    const handlerName = normalizeHandlerName(key.slice("LLM_HANDLER_".length));
    if (!handlerName) continue;
    const normalized = value.trim().toLowerCase();
    if (isProviderName(normalized)) {
      handlers[handlerName] = normalized;
    } else {
      console.warn(
        `[llm portal] Ignoring ${key}=${JSON.stringify(value)} ` +
          `— not a known provider name (${VALID_PROVIDERS.join(", ")}). ` +
          `This handler will use the default provider.`,
      );
    }
  }

  return { defaultProvider, handlers };
}
