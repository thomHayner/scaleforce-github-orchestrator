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

/**
 * Resolve the portal config from environment variables.
 *
 * Recognized env vars:
 * - LLM_DEFAULT_PROVIDER — global default (e.g. "openai", "anthropic", "mock").
 * - LLM_HANDLER_<NAME>   — per-handler override (e.g. LLM_HANDLER_ISSUESAI=anthropic).
 *                          Names are uppercased; underscores allowed.
 *
 * If LLM_DEFAULT_PROVIDER is unset, the default is "mock" so module load and
 * tests succeed without any vendor key. Adapters self-report availability via
 * isAvailable(); the portal falls back to mock when the configured adapter is
 * unavailable.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): PortalConfig {
  const rawDefault = env.LLM_DEFAULT_PROVIDER?.trim().toLowerCase();
  const defaultProvider: ProviderName =
    rawDefault && isProviderName(rawDefault) ? rawDefault : "mock";

  const handlers: Record<string, ProviderName> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("LLM_HANDLER_") || !value) continue;
    const handlerName = key.slice("LLM_HANDLER_".length).toLowerCase();
    if (!handlerName) continue;
    const normalized = value.trim().toLowerCase();
    if (isProviderName(normalized)) {
      handlers[handlerName] = normalized;
    }
  }

  return { defaultProvider, handlers };
}
