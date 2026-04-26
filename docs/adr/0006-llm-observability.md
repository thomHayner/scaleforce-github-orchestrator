# 0006. LLM observability: structured agent-event logs now, tracing vendor deferred

- **Status**: proposed
- **Date**: 2026-04-19
- **Deciders**: @thomHayner
- **Tags**: observability, bots, orchestration

## Context and Problem Statement

This repo runs an "AI agency" pattern: `claude[bot]`, `copilot-pull-request-reviewer[bot]`, and `scaleforce[bot]` coordinate on PRs, with more agents likely to follow (see [ADR 0003](0003-bot-identity-separation.md), [ADR 0005](0005-copilot-reviewer-loop.md)). When something goes wrong — a review loop that won't converge, a bot posting under the wrong identity, a PR that stalls — we currently have no single place to look. Each signal lives in a different surface: GitHub Actions logs for Claude Code Action runs, webhook delivery logs for `scaleforce[bot]`, PR timelines for Copilot.

The question: do we need an LLM observability tool (Langfuse, Helicone, Arize, LangSmith) now?

Framing matters. The LLM calls themselves happen inside the Claude Code Action and Copilot — vendor-hosted surfaces we don't control. What we *do* control and need to see is the **orchestration layer**: which agent acted, on which PR, why, and with what outcome. That's agent-event telemetry, not prompt-trace telemetry.

## Decision Drivers

- No self-hosted inference path yet. The Anthropic API isn't called from our own code; it's called inside the Claude Code Action. A prompt-trace tool would see nothing.
- The live operational risk is [ADR 0005](0005-copilot-reviewer-loop.md)'s review loop: we need to know if it's converging, and at which iteration a given PR sits.
- Identity attribution is load-bearing (see [CLAUDE.md](../../CLAUDE.md)). Knowing *who posted what* after the fact needs to be easy.
- Small repo, one maintainer. Vendor overhead (accounts, keys, dashboards, bills) should be justified by a question we can't answer without it.
- Whatever we pick should extend as new agents join without a rewrite.

## Considered Options

- **Option A: adopt an LLM tracing vendor now** (Langfuse / Helicone / LangSmith). Wire up trace ingestion from `scaleforce[bot]` and any future inference paths.
- **Option B: structured JSON event logs from `scaleforce[bot]`**, emitted to stdout and collected by whatever hosts probot (Fly/Vercel/Railway logs). No vendor. Schema versioned in-repo.
- **Option C: do nothing; rely on GitHub audit log + Actions logs.** Grep when needed.
- **Option D: hybrid** — Option B now, revisit a vendor when we have a self-hosted inference path worth tracing.

## Decision Outcome

Chosen: **Option D**.

Implement Option B immediately. Revisit vendor tooling when (a) this repo or a downstream service calls the Anthropic API directly, or (b) event-log volume makes grep-and-jq painful.

### What `scaleforce[bot]` logs

One JSON line per orchestration event, stdout:

```json
{
  "ts": "2026-04-19T14:22:31Z",
  "schema": "scaleforce.event.v1",
  "event": "copilot_review_received",
  "pr": "thomHayner/AIHawk_Birdwatcher#42",
  "actor": "copilot-pull-request-reviewer[bot]",
  "loop_iteration": 3,
  "outcome": "comments_present",
  "comment_count": 2,
  "latency_ms": 18400,
  "correlation_id": "pr-42-loop-3"
}
```

Event types to cover at minimum:
- `review_requested` — `scaleforce[bot]` asked Copilot to review.
- `copilot_review_received` — review came back; carries `comment_count` and loop iteration.
- `author_pinged` / `maintainer_escalated` — routing decisions from [ADR 0005](0005-copilot-reviewer-loop.md).
- `loop_exited` — zero-comments exit, with total iterations.
- `loop_capped` — iteration 7 reached; human breakpoint.

Schema lives in the probot repo alongside the code that emits it. Bump `schema` field on breaking changes.

### What we don't log (yet)

- Prompt contents or model responses. The Claude Code Action handles its own LLM I/O and we don't have a clean hook into it.
- Token counts or cost. Not ours to measure until we call the API directly.
- Copilot's review text. GitHub already stores it on the PR; duplicating is noise.

### Consequences

- Good: answers the questions we actually have today (is the review loop healthy? who acted when?) without standing up a vendor.
- Good: the event stream is a natural input to a tracer later — when we adopt Langfuse or similar, these events become spans in a parent trace.
- Good: schema-in-repo means agents reading [`llm-wiki/`](../../llm-wiki/) can reason about the event shape.
- Bad: no prompt-level visibility. If Claude Code Action produces a weird review or wrong code, we'll still be reading Actions logs by hand.
- Bad: stdout JSON only goes as far as the host's log retention. If we need history beyond that, we'll need to ship logs somewhere (Axiom, Grafana Cloud, S3+Athena) — deferred until the need is real.
- Neutral: revisit trigger is concrete — self-hosted inference path or log-volume pain. Not a vague "someday."

## Pros and Cons of the Options

### Option A: vendor tracing now
- Good: batteries-included dashboards, prompt replay, cost tracking.
- Bad: nothing to trace today. The LLM calls are inside vendor-hosted agents; we'd be paying for an empty dashboard.
- Bad: another account, key, and bill to manage for a one-maintainer repo.

### Option B: structured event logs (standalone)
- Good: cheap, in our control, schema versioned with the code.
- Good: directly answers the [ADR 0005](0005-copilot-reviewer-loop.md) "is the loop converging?" question.
- Bad: no prompt-level visibility. Won't help debug *why* an agent produced a bad output.

### Option C: do nothing
- Good: zero work.
- Bad: review-loop health is currently invisible; we won't notice pathological loops until the 7-iteration cap fires.

### Option D: hybrid (chosen)
- Good: does the cheap useful thing now; keeps the door open for the expensive useful thing when it's justified.
- Bad: requires us to actually revisit when triggers hit — needs to show up on the roadmap, not be forgotten.

## More Information

- [ADR 0003](0003-bot-identity-separation.md) — identity separation; log `actor` field maps to these identities.
- [ADR 0005](0005-copilot-reviewer-loop.md) — the review loop whose health these events measure.
- Revisit triggers: (a) any service in this org starts calling the Anthropic API directly, or (b) `scaleforce[bot]` event volume exceeds ~1k/day or host log retention stops being sufficient.
