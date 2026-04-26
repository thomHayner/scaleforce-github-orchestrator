import type {
  Capabilities,
  CompleteInput,
  CompleteOutput,
  LlmProvider,
} from "../types.js";

const capabilities: Capabilities = {
  streaming: false,
  structuredOutput: false,
  toolUse: true,
  vision: false,
  contextWindow: 0,
};

/**
 * No-op adapter used as the default when no provider env is configured (e.g. in
 * tests). Returns deterministic placeholder content so handlers can be exercised
 * end-to-end without a real vendor key.
 */
export const mockProvider: LlmProvider = {
  name: "mock",
  capabilities,
  isAvailable() {
    return true;
  },
  async complete(input: CompleteInput): Promise<CompleteOutput> {
    const lastUser = [...input.messages]
      .reverse()
      .find((m) => m.role === "user");
    const echo =
      lastUser && "content" in lastUser
        ? `[mock] ${lastUser.content.slice(0, 200)}`
        : "[mock] no user message";
    return {
      content: echo,
      toolCalls: [],
      finishReason: "stop",
    };
  },
};
