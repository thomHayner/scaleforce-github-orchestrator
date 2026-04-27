import type {
  Capabilities,
  CompleteInput,
  CompleteOutput,
  LlmProvider,
} from "../types.js";

const capabilities: Capabilities = {
  streaming: true,
  structuredOutput: true,
  toolUse: true,
  vision: true,
  contextWindow: 131_072,
};

// Stub adapter. xAI ships an OpenAI-compatible endpoint at https://api.x.ai/v1
// so this can be wired by reusing the openai adapter pattern with a custom
// baseURL. Left as a stub until a handler actually targets Grok — the portal
// is the place to add it; do not import the xAI SDK from a handler.
export const grokProvider: LlmProvider = {
  name: "grok",
  capabilities,
  isAvailable() {
    return Boolean(process.env.XAI_API_KEY);
  },
  async complete(_input: CompleteInput): Promise<CompleteOutput> {
    throw new Error(
      "grok provider is not implemented yet. " +
        "Wire it via xAI's OpenAI-compatible endpoint (https://api.x.ai/v1) " +
        "when the first handler targets it.",
    );
  },
};
