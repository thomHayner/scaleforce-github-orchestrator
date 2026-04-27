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
  contextWindow: 200_000,
};

const DEFAULT_MODEL = "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// Implemented against the Anthropic Messages REST API directly to avoid
// pulling in @anthropic-ai/sdk as a runtime dependency for the bot. If we
// later need streaming, structured outputs, or token counting, swap to the
// SDK behind this same adapter surface.

type NonSystemMessage = Exclude<LlmMessage, { role: "system" }>;

interface SplitMessages {
  system: string | undefined;
  rest: NonSystemMessage[];
}

function splitSystem(messages: LlmMessage[]): SplitMessages {
  const systemParts: string[] = [];
  const rest: NonSystemMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
    } else {
      rest.push(m);
    }
  }
  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    rest,
  };
}

function toAnthropicMessages(messages: NonSystemMessage[]): any[] {
  return messages.map((m) => {
    if (m.role === "user") {
      return { role: "user", content: m.content };
    }
    if (m.role === "assistant") {
      const content: any[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          let parsed: unknown = {};
          try {
            parsed = JSON.parse(tc.arguments);
          } catch {
            parsed = { _raw: tc.arguments };
          }
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: parsed,
          });
        }
      }
      return { role: "assistant", content };
    }
    // tool result -> Anthropic encodes as a user message with tool_result blocks
    return {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: m.toolCallId,
          content: m.content,
        },
      ],
    };
  });
}

function toAnthropicTools(tools: LlmTool[] | undefined): any[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    name: t.name,
    ...(t.description ? { description: t.description } : {}),
    input_schema: t.parameters,
  }));
}

function mapStopReason(reason: string | null | undefined): FinishReason {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
    default:
      return "other";
  }
}

export const anthropicProvider: LlmProvider = {
  name: "anthropic",
  capabilities,
  isAvailable() {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  },
  async complete(input: CompleteInput): Promise<CompleteOutput> {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "Anthropic provider selected but ANTHROPIC_API_KEY is missing or empty. " +
          "Set the env var or change the provider via LLM_DEFAULT_PROVIDER " +
          "(see docs/setup/llm-providers.md).",
      );
    }
    const { system, rest } = splitSystem(input.messages);
    const body: Record<string, unknown> = {
      model: input.model ?? DEFAULT_MODEL,
      max_tokens: input.maxTokens ?? 4096,
      messages: toAnthropicMessages(rest),
    };
    if (system) body.system = system;
    const tools = toAnthropicTools(input.tools);
    if (tools) body.tools = tools;
    if (input.temperature !== undefined) body.temperature = input.temperature;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Anthropic API error ${response.status}: ${text.slice(0, 500)}`,
      );
    }
    const data: any = await response.json();
    const blocks: any[] = data.content ?? [];
    const textParts: string[] = [];
    const toolCalls: LlmToolCall[] = [];
    for (const block of blocks) {
      if (block.type === "text") textParts.push(block.text);
      else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        });
      }
    }
    return {
      content: textParts.length > 0 ? textParts.join("\n") : null,
      toolCalls,
      finishReason: mapStopReason(data.stop_reason),
      raw: data,
    };
  },
};
