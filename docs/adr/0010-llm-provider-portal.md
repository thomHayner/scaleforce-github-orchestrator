# 0010. LLM provider portal

- **Status**: accepted
- **Date**: 2026-04-26
- **Deciders**: @thomHayner
- **Tags**: architecture, llm, portability

## Context and Problem Statement

Until now, LLM calls inside `scaleforce[bot]` have been hardwired to OpenAI by import location: handlers under `src/completions/` did `import OpenAi from "openai"` and instantiated `new OpenAi({ apiKey: process.env.OPENAI_API_KEY })` at module scope. This has two concrete failure modes:

1. **Module-load crash without the key.** `npm test` fails before any test can run when `OPENAI_API_KEY` is unset, because the constructor throws during import. This blocks the verify discipline (`lint && test && build`) required by the recursive Copilot-review loop ([ADR 0005](0005-copilot-reviewer-loop.md)) for any contributor without an OpenAI key. The crash surfaced during round-1 verify on PR #13 (commit ea43d59) and motivated [#14](https://github.com/thomHayner/scaleforce-github-orchestrator/issues/14).
2. **Vendor lock-in by import.** Switching a handler from OpenAI to Anthropic / xAI / Vercel v0 / a local model (Ollama, llama.cpp, LM Studio) requires editing the handler's source, not config. There is no place to plug in a fake adapter for tests, no place to declare per-handler routing, and no taxonomy for capability-based routing.

A cleaner fallback key (e.g. `process.env.OPENAI_API_KEY ?? "sk-test"`) papers over the symptom but cements the underlying coupling.

## Decision Drivers

- The verify discipline must work without a vendor key.
- Provider selection must be config-driven so we can swap vendors per handler without touching handler code.
- Adding a new vendor must mean writing one adapter file, not touching every handler.
- The portal must not regress the LLM-call boundary defined in [ADR 0005 § Classifier boundary](0005-copilot-reviewer-loop.md#classifier-boundary). Templated-classification discipline is independent of transport.
- Minimal new runtime dependencies. The bot is small and we want to keep it that way.

## Considered Options

- **Option A: Single shim re-exporting OpenAI.** Move the `new OpenAI(...)` into `src/llm/openai.ts` and re-export. Handlers import from there. Fixes the lazy-construction bug but doesn't address vendor portability or capability routing.
- **Option B: Vercel AI SDK as the portal.** Adopt `ai` (Vercel) as the abstraction. Breadth of providers, streaming-first ergonomics. But it's a substantial new runtime dependency, opinionated about message shape, and ties our portal evolution to a third-party SDK roadmap.
- **Option C: Build a thin in-house portal with per-vendor adapters and config-driven selection.** Adapter per vendor in `src/llm/providers/`, lazy SDK construction, capability flags, mock adapter for tests, env-driven config.

## Decision Outcome

Chosen option: **Option C — thin in-house portal**, because it is small enough to read in one sitting, keeps our runtime dependency list minimal (Anthropic and local providers are wired with `fetch`, no new SDK deps), and gives us exactly the integration points we need (lazy construction, capability flags, mock adapter) without coupling our roadmap to a third-party SDK.

### Interface

The portal exposes a single `complete(input, opts)` function plus a small set of types:

```ts
type LlmMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

interface LlmTool { name: string; description?: string; parameters: Record<string, unknown>; }
interface CompleteInput { messages: LlmMessage[]; model?: string; tools?: LlmTool[]; temperature?: number; maxTokens?: number; }
interface CompleteOutput { content: string | null; toolCalls: LlmToolCall[]; finishReason: FinishReason; raw?: unknown; }
interface CompleteOpts { handler?: string; provider?: ProviderName; requireCapabilities?: Partial<Capabilities>; }
```

Tools are described as JSON Schema directly so the portal does not depend on Zod or a particular schema library.

### Capability-flag taxonomy

Each adapter declares:

| Flag | Meaning |
|---|---|
| `streaming` | Adapter can stream tokens (the portal does not yet expose this; reserved). |
| `structuredOutput` | Adapter supports JSON-schema-constrained outputs natively. |
| `toolUse` | Adapter accepts and returns function/tool calls. |
| `vision` | Adapter accepts image inputs. |
| `contextWindow` | Approximate context window in tokens (`0` = unknown). |

`complete()` accepts `requireCapabilities` and falls back to `mock` if the resolved provider does not satisfy them. The flag set is intentionally small — large enough for routing decisions, small enough to be honestly reportable per vendor.

### Lazy-construction invariant

Adapters MUST NOT instantiate any vendor SDK client at module load. SDK construction happens inside the first `complete()` call. `isAvailable()` reads env vars only. This is the invariant that prevents the test-time crash from recurring.

### Provider selection

Order of precedence:

1. `opts.provider` — explicit override.
2. `LLM_HANDLER_<NAME>` env var matching `opts.handler`.
3. `LLM_DEFAULT_PROVIDER` env var.
4. `mock` if none of the above is set.

If the resolved provider's `isAvailable()` returns false (e.g. selected `openai` but no `OPENAI_API_KEY`), the portal silently falls back to `mock`. This is intentional for test ergonomics; production should set the keys it expects to use.

### Initial provider matrix

| Provider | Status |
|---|---|
| `openai` | wired (lazy SDK init via `import("openai")`) |
| `anthropic` | wired (Messages REST API, no SDK dep) |
| `local` | wired (OpenAI-compatible chat-completions via `fetch`; Ollama / llama.cpp / LM Studio / vLLM) |
| `grok` | stub (xAI exposes an OpenAI-compatible endpoint) |
| `v0` | stub (v0 exposes an OpenAI-compatible endpoint) |
| `mock` | always available; default in tests |

Stubs throw on `complete()` so misconfiguration fails loudly.

### Consequences

- Good: `npm test` runs without `OPENAI_API_KEY`. The verify step from [ADR 0005](0005-copilot-reviewer-loop.md) is reachable for every contributor.
- Good: Provider selection is config, not code. Switching `issuesAi` from OpenAI to Anthropic is `export LLM_HANDLER_ISSUESAI=anthropic`.
- Good: Adding a new vendor is one adapter file plus a registry line.
- Good: Mock adapter gives tests a deterministic boundary without mocking the vendor SDK.
- Bad: The portal's interface is necessarily a subset. Vendor-specific features (e.g. Anthropic prompt caching, OpenAI structured outputs) are not abstracted; adapters expose them via `raw` or via per-vendor extensions. This matches the non-goal in [#14](https://github.com/thomHayner/scaleforce-github-orchestrator/issues/14): we are not building a unified prompt-caching layer.
- Bad: Two surface areas now (portal + adapters). A vendor SDK update could require an adapter update.
- Neutral: The portal is the **transport**. The classifier-boundary discipline from [ADR 0005 § Classifier boundary](0005-copilot-reviewer-loop.md#classifier-boundary) still applies to *what* an LLM call is allowed to decide inside `scaleforce[bot]` — the portal does not relax it.

## Pros and Cons of the Options

### Option A: Single OpenAI shim
- Good: Smallest possible change; fixes lazy-construction bug.
- Bad: Doesn't address vendor portability. The day we want Anthropic, we redo this work.

### Option B: Vercel AI SDK
- Good: Battle-tested abstraction with broad provider coverage and streaming-first ergonomics.
- Bad: Substantial new runtime dependency. Opinionated about shape (e.g. message format, tool schemas). Couples our roadmap to a third-party SDK we don't otherwise use.

### Option C: In-house thin portal *(chosen)*
- Good: Small, readable, exactly the integration points we need. No new runtime SDK deps for Anthropic or local providers.
- Bad: We own the maintenance. Each new vendor is a small adapter file we have to write and update.

## More Information

- Issue: [#14](https://github.com/thomHayner/scaleforce-github-orchestrator/issues/14)
- PR where the crash surfaced: [#13](https://github.com/thomHayner/scaleforce-github-orchestrator/pull/13)
- Provider setup: [`docs/setup/llm-providers.md`](../setup/llm-providers.md)
- Related: [ADR 0005 § Classifier boundary](0005-copilot-reviewer-loop.md#classifier-boundary), [ADR 0006](0006-llm-observability.md)
