import type {
  Capabilities,
  CompleteInput,
  CompleteOutput,
  LlmProvider,
} from "../types.js";

const capabilities: Capabilities = {
  streaming: true,
  structuredOutput: false,
  toolUse: false,
  vision: true,
  contextWindow: 128_000,
};

// Stub adapter for Vercel v0. The v0 platform exposes an OpenAI-compatible
// chat completions API at https://api.v0.dev/v1 — wire this when we have a
// handler that actually targets it. Until then, throw on use so misconfiguration
// fails loudly rather than silently routing somewhere unexpected.
export const v0Provider: LlmProvider = {
  name: "v0",
  capabilities,
  isAvailable() {
    return Boolean(process.env.V0_API_KEY);
  },
  async complete(_input: CompleteInput): Promise<CompleteOutput> {
    throw new Error(
      "v0 provider is not implemented yet. " +
        "Wire it via v0's OpenAI-compatible endpoint (https://api.v0.dev/v1) " +
        "when the first handler targets it.",
    );
  },
};
