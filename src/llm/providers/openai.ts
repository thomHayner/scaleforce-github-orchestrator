import type {
  Capabilities,
  CompleteInput,
  CompleteOutput,
  FinishReason,
  LlmMessage,
  LlmProvider,
  LlmTool,
  LlmToolCall,
} from "../types.js";

const capabilities: Capabilities = {
  streaming: true,
  structuredOutput: true,
  toolUse: true,
  vision: true,
  contextWindow: 128_000,
};

const DEFAULT_MODEL = "gpt-4o-mini";

// Cached client + module ref. The OpenAI SDK is required lazily so that
// importing the portal — or any handler that uses it — never reaches for
// OPENAI_API_KEY at module load. A missing key here only matters when this
// adapter is actually selected and invoked.
let cachedClient: unknown | null = null;

async function getClient(): Promise<any> {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenAI provider selected but OPENAI_API_KEY is not set. " +
        "Set the env var or change the provider via LLM_DEFAULT_PROVIDER " +
        "(see docs/setup/llm-providers.md).",
    );
  }
  const mod = await import("openai");
  const OpenAI = (mod as any).default ?? (mod as any).OpenAI;
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

function toOpenAiMessages(messages: LlmMessage[]): any[] {
  return messages.map((m) => {
    switch (m.role) {
      case "system":
      case "user":
        return { role: m.role, content: m.content };
      case "assistant":
        return {
          role: "assistant",
          content: m.content,
          ...(m.toolCalls && m.toolCalls.length > 0
            ? {
                tool_calls: m.toolCalls.map((tc) => ({
                  id: tc.id,
                  type: "function",
                  function: { name: tc.name, arguments: tc.arguments },
                })),
              }
            : {}),
        };
      case "tool":
        return {
          role: "tool",
          content: m.content,
          tool_call_id: m.toolCallId,
        };
    }
  });
}

function toOpenAiTools(tools: LlmTool[] | undefined): any[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      ...(t.description ? { description: t.description } : {}),
      parameters: t.parameters,
    },
  }));
}

function mapFinishReason(reason: string | null | undefined): FinishReason {
  switch (reason) {
    case "stop":
    case "tool_calls":
    case "length":
    case "content_filter":
      return reason;
    default:
      return "other";
  }
}

export const openaiProvider: LlmProvider = {
  name: "openai",
  capabilities,
  isAvailable() {
    return Boolean(process.env.OPENAI_API_KEY);
  },
  async complete(input: CompleteInput): Promise<CompleteOutput> {
    const client = await getClient();
    const params: Record<string, unknown> = {
      model: input.model ?? DEFAULT_MODEL,
      messages: toOpenAiMessages(input.messages),
    };
    const tools = toOpenAiTools(input.tools);
    if (tools) params.tools = tools;
    if (input.temperature !== undefined) params.temperature = input.temperature;
    if (input.maxTokens !== undefined) params.max_tokens = input.maxTokens;

    const response = await client.chat.completions.create(params);
    const choice = response.choices[0];
    const message = choice.message;
    const toolCalls: LlmToolCall[] = (message.tool_calls ?? []).map(
      (tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }),
    );
    return {
      content: message.content ?? null,
      toolCalls,
      finishReason: mapFinishReason(choice.finish_reason),
      raw: response,
    };
  },
};
