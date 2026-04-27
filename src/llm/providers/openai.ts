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
  // OpenAI supports JSON-schema-constrained output via response_format, but
  // the portal's CompleteInput surface doesn't yet carry a schema/responseFormat
  // field — there's no way for callers to request structured output, and this
  // adapter doesn't pass anything to the SDK that would constrain the response.
  // Advertising the capability would let `requireCapabilities: { structuredOutput: true }`
  // route here without anything actually enforcing structure, which is worse
  // than honestly declining. Flip to `true` once CompleteInput grows the field.
  structuredOutput: false,
  toolUse: true,
  // OpenAI accepts image inputs, but the portal's LlmMessage only carries
  // string content — there's no multimodal payload reaching this adapter,
  // so advertising vision would let `requireCapabilities: { vision: true }`
  // route here without anything actually attaching an image. Same reasoning
  // as the structuredOutput note above. Flip to `true` once LlmMessage grows
  // a multimodal content variant.
  vision: false,
  contextWindow: 128_000,
};

const DEFAULT_MODEL = "gpt-4o-mini";

// Cached client + module ref. The OpenAI SDK is required lazily so that
// importing the portal — or any handler that uses it — never reaches for
// OPENAI_API_KEY at module load. A missing key here only matters when this
// adapter is actually selected and invoked.
//
// We cache the in-flight Promise (not just the resolved client) so that
// concurrent webhook handlers racing on first init don't each kick off a
// separate `import("openai")` + `new OpenAI(...)`. On failure we clear
// the promise so the next caller can retry.
let cachedClient: unknown | null = null;
let cachedClientPromise: Promise<any> | null = null;

async function getClient(): Promise<any> {
  if (cachedClient) return cachedClient;
  if (cachedClientPromise) return cachedClientPromise;
  cachedClientPromise = (async () => {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "OpenAI provider selected but OPENAI_API_KEY is missing or empty. " +
          "Set the env var or change the provider via LLM_DEFAULT_PROVIDER " +
          "(see docs/setup/llm-providers.md).",
      );
    }
    const mod = await import("openai");
    const OpenAI = (mod as any).default ?? (mod as any).OpenAI;
    const client = new OpenAI({ apiKey });
    cachedClient = client;
    return client;
  })().catch((error) => {
    cachedClientPromise = null;
    throw error;
  });
  return cachedClientPromise;
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
    return Boolean(process.env.OPENAI_API_KEY?.trim());
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
