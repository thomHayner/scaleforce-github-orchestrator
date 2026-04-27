// Provider-neutral message and tool-call shapes used by the LLM portal.
// Adapters in src/llm/providers/ translate these to/from vendor SDKs.

export type ProviderName =
  | "openai"
  | "anthropic"
  | "grok"
  | "v0"
  | "local"
  | "mock";

export type LlmRole = "system" | "user" | "assistant" | "tool";

export interface LlmToolCall {
  id: string;
  name: string;
  /** JSON-encoded arguments string, mirroring OpenAI/Anthropic conventions. */
  arguments: string;
}

export type LlmMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      toolCalls?: LlmToolCall[];
    }
  | {
      role: "tool";
      toolCallId: string;
      content: string;
    };

export interface LlmTool {
  name: string;
  description?: string;
  /** JSON Schema describing the function parameters. */
  parameters: Record<string, unknown>;
}

export interface CompleteInput {
  messages: LlmMessage[];
  /** Model id understood by the chosen provider. Optional — adapters fall back to a default. */
  model?: string;
  tools?: LlmTool[];
  temperature?: number;
  maxTokens?: number;
}

export type FinishReason =
  | "stop"
  | "tool_calls"
  | "length"
  | "content_filter"
  | "other";

export interface CompleteOutput {
  content: string | null;
  toolCalls: LlmToolCall[];
  finishReason: FinishReason;
  /** Provider-specific raw response, for adapters that need to round-trip vendor state. */
  raw?: unknown;
}

export interface Capabilities {
  streaming: boolean;
  structuredOutput: boolean;
  toolUse: boolean;
  vision: boolean;
  /** Approximate context window in tokens. 0 means unknown. */
  contextWindow: number;
}

export interface LlmProvider {
  readonly name: ProviderName;
  readonly capabilities: Capabilities;
  /**
   * Returns true if the adapter has the env/config it needs to actually call the
   * vendor. Used by the portal to decide whether to fall back to the mock adapter.
   * Must not instantiate any SDK client.
   */
  isAvailable(): boolean;
  complete(input: CompleteInput): Promise<CompleteOutput>;
}

export interface CompleteOpts {
  /** Logical handler name, e.g. "issuesAi". Looked up in PortalConfig.handlers. */
  handler?: string;
  /** Explicit provider override; bypasses handler lookup. */
  provider?: ProviderName;
  /** Require these capabilities on the resolved provider; fall back to mock if it does not satisfy them. */
  requireCapabilities?: Partial<Capabilities>;
}
