import type {
  Capabilities,
  CompleteInput,
  CompleteOutput,
  FinishReason,
  LlmMessage,
  LlmProvider,
  LlmToolCall,
} from "../types.js";

const capabilities: Capabilities = {
  streaming: false,
  structuredOutput: false,
  toolUse: false,
  vision: false,
  contextWindow: 0,
};

const DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1"; // Ollama default
const DEFAULT_MODEL = "llama3.1";

// Talks to any OpenAI-Chat-Completions-compatible local server: Ollama (with
// /v1 enabled), llama.cpp's --api server, LM Studio's local server, vLLM, etc.
// Configured via LLM_LOCAL_BASE_URL and LLM_LOCAL_MODEL. Tool use varies by
// model and runtime so the capability flag is conservatively false; handlers
// that need tools should not route here.

function toOpenAiCompatibleMessages(messages: LlmMessage[]): any[] {
  return messages.map((m) => {
    switch (m.role) {
      case "system":
      case "user":
        return { role: m.role, content: m.content };
      case "assistant":
        return { role: "assistant", content: m.content ?? "" };
      case "tool":
        return {
          role: "tool",
          content: m.content,
          tool_call_id: m.toolCallId,
        };
    }
  });
}

function mapFinishReason(reason: string | null | undefined): FinishReason {
  switch (reason) {
    case "stop":
    case "length":
      return reason;
    case "tool_calls":
      return "tool_calls";
    default:
      return "other";
  }
}

export const localProvider: LlmProvider = {
  name: "local",
  capabilities,
  isAvailable() {
    // Local servers don't expose a uniform health check, so availability is
    // gated on opt-in via env. Adapters self-report; the actual reachability
    // check happens in complete().
    return Boolean(process.env.LLM_LOCAL_BASE_URL || process.env.LLM_LOCAL_MODEL);
  },
  async complete(input: CompleteInput): Promise<CompleteOutput> {
    const baseUrl = (process.env.LLM_LOCAL_BASE_URL ?? DEFAULT_BASE_URL).replace(
      /\/$/,
      "",
    );
    const model = input.model ?? process.env.LLM_LOCAL_MODEL ?? DEFAULT_MODEL;
    const body: Record<string, unknown> = {
      model,
      messages: toOpenAiCompatibleMessages(input.messages),
    };
    if (input.temperature !== undefined) body.temperature = input.temperature;
    if (input.maxTokens !== undefined) body.max_tokens = input.maxTokens;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Local LLM error ${response.status} from ${baseUrl}: ${text.slice(0, 500)}`,
      );
    }
    const data: any = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message ?? {};
    const toolCalls: LlmToolCall[] = (message.tool_calls ?? []).map(
      (tc: any) => ({
        id: tc.id,
        name: tc.function?.name ?? "",
        arguments: tc.function?.arguments ?? "",
      }),
    );
    return {
      content: message.content ?? null,
      toolCalls,
      finishReason: mapFinishReason(choice?.finish_reason),
      raw: data,
    };
  },
};
