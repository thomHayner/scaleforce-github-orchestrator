# LLM provider portal

The bot routes every LLM call through `src/llm/` — a thin portal in front of
per-vendor adapters. Handlers call `complete(input, opts)`; the portal picks an
adapter based on config and falls back to a mock when nothing is configured.

See [ADR 0010](../adr/0010-llm-provider-portal.md) for the rationale.

## Why

Direct `import OpenAI from "openai"` calls in handlers are forbidden because:

1. **Module-load failures.** `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`
   at module scope crashes the test runner when no key is present. The portal
   constructs vendor SDK clients lazily — only when actually invoked.
2. **Vendor lock-in.** Switching providers (or wiring a new one) should be
   config, not code.
3. **Capability routing.** Handlers can ask for "any provider that supports
   tool use" without naming one.

## Selecting a provider

Two environment variables drive selection:

| Variable | Purpose | Example |
|---|---|---|
| `LLM_DEFAULT_PROVIDER` | Global default | `openai`, `anthropic`, `local`, `mock` |
| `LLM_HANDLER_<NAME>`   | Per-handler override (matches the `handler` arg passed to `complete()`) | `LLM_HANDLER_ISSUESAI=anthropic` |

If unset, the default is `mock`. If a configured provider is unavailable
(missing key, etc.), the portal falls back to `mock` — silent fallback only
matters in tests, since CI/prod sets the key explicitly.

## Per-provider env

| Provider | Status | Env vars | Notes |
|---|---|---|---|
| `openai` | wired | `OPENAI_API_KEY` | Lazy SDK init via `import("openai")`. |
| `anthropic` | wired | `ANTHROPIC_API_KEY` | Implemented against the Messages REST API to avoid an SDK dep. |
| `local` | wired | `LLM_LOCAL_BASE_URL` (default `http://127.0.0.1:11434/v1`), `LLM_LOCAL_MODEL` (default `llama3.1`) | Any OpenAI-compatible server: Ollama (with `/v1`), llama.cpp `--api`, LM Studio, vLLM. **Opt-in:** at least one of these env vars must be set for `isAvailable()` to return true — otherwise the portal falls back to `mock` even when `LLM_DEFAULT_PROVIDER=local`. The defaults above only kick in once you've opted in. Capability flag `toolUse` is conservatively `false`. |
| `grok` | stub | `XAI_API_KEY` | Throws on use; xAI exposes an OpenAI-compatible endpoint at `https://api.x.ai/v1` — wire when first handler targets it. |
| `v0` | stub | `V0_API_KEY` | Throws on use; v0's chat completions endpoint at `https://api.v0.dev/v1`. |
| `mock` | always available | — | Deterministic placeholder. The default for tests. |

## The mock adapter

The mock adapter returns `[mock] <last-user-message-prefix>` and no tool calls.
Tests should never need a real key; running `unset OPENAI_API_KEY && npx vitest run`
must succeed. Handlers that depend on a specific tool-call shape should mock
the portal at the `complete()` boundary rather than the vendor SDK.

## Calling the portal

```ts
import { complete, type LlmTool } from "../llm/index.js";

const myTool: LlmTool = {
  name: "addLabel",
  description: "Apply the chosen primary label.",
  parameters: {
    type: "object",
    required: ["primaryLabel"],
    properties: {
      primaryLabel: { type: "string", enum: ["bug", "enhancement"] },
    },
  },
};

const result = await complete(
  {
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a triage agent." },
      { role: "user", content: "Issue body here..." },
    ],
    tools: [myTool],
  },
  { handler: "issuesai" },
);

if (result.finishReason === "tool_calls") {
  for (const call of result.toolCalls) {
    /* dispatch */
  }
}
```

`opts` accepts:

- `handler` — logical name looked up in `LLM_HANDLER_<NAME>`. Lowercased.
- `provider` — explicit override (`"openai"`, `"anthropic"`, ...). Bypasses handler lookup.
- `requireCapabilities` — `Partial<Capabilities>`; falls back to `mock` if the resolved provider can't satisfy them.

## Adding a new provider

1. Create `src/llm/providers/<name>.ts` exporting an `LlmProvider`.
2. Implement `isAvailable()` against env vars only — do not instantiate any client.
3. Implement `complete()` translating to/from the portal's `LlmMessage`/`LlmToolCall` shapes.
4. Register in `src/llm/registry.ts` and add the name to `ProviderName` in `src/llm/types.ts`.
5. Update this doc and the ADR's status table.

The portal is the **only** allowed entry point for LLM calls in handler code.
Direct vendor SDK imports outside `src/llm/providers/` are a convention
violation — see `CLAUDE.md` and `AGENTS.md`.
