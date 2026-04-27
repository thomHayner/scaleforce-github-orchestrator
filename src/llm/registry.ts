import { anthropicProvider } from "./providers/anthropic.js";
import { grokProvider } from "./providers/grok.js";
import { localProvider } from "./providers/local.js";
import { mockProvider } from "./providers/mock.js";
import { openaiProvider } from "./providers/openai.js";
import { v0Provider } from "./providers/v0.js";
import type { LlmProvider, ProviderName } from "./types.js";

const providers: Record<ProviderName, LlmProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  grok: grokProvider,
  v0: v0Provider,
  local: localProvider,
  mock: mockProvider,
};

export function getProvider(name: ProviderName): LlmProvider {
  return providers[name];
}

export function listProviders(): LlmProvider[] {
  return Object.values(providers);
}
