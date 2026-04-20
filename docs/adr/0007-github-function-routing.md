# 0007. GitHub function routing: cascading defaults with per-function overrides

- **Status**: proposed
- **Date**: 2026-04-19
- **Deciders**: @thomHayner
- **Tags**: routing, orchestration, bots, configuration

## Context and Problem Statement

`scaleforce[bot]` orchestrates a growing number of GitHub-facing functions — issue intake, discussions, documentation edits, PR prep, PR reviews, and so on. Each function can, in principle, be owned by a different agent: Claude, Copilot, Codex when added, or the maintainer. We want to express ownership like a design-system token: **set one default, override by slot where needed**, and extend as new agents join without rewriting any routing logic.

Empirical constraints from earlier decisions narrow what's assignable:

- Only `copilot-pull-request-reviewer[bot]` can be attached to a PR via `requested_reviewers` (see [ADR 0003](0003-bot-identity-separation.md) and [ADR 0005](0005-copilot-reviewer-loop.md)). GitHub silently rejects every other App — `claude[bot]` and `scaleforce[bot]` both fail when assigned this way.
- No bot can post an `APPROVED` review. Branch-protection approvals require a human ([GitHub docs: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)).
- For functions *other* than PR reviews (issues, discussions, docs, PR prep), any agent that can be pinged in a comment or run as a skill/action can own the function — the constraint is mechanism, not identity.

So the routing schema needs two distinct "rails":

- **Dispatch rail** — who gets the work. A default handler, plus per-function overrides.
- **Mechanism rail** — how that handler is actually invoked for a given function (reviewer assignment, `@mention`, skill invocation, GitHub Action, etc.). Constrained by GitHub.

## Decision Drivers

- Extending to a new agent should be a config change, not a code change.
- A single "whole agency" theme ("Claude runs everything", "Copilot runs everything") should be expressible in one line.
- One-off overrides ("Copilot for PR reviews, Claude for everything else") should be expressible without forking the default.
- The schema must respect hard GitHub constraints — it should not let a user configure `claude[bot]` as a PR reviewer, because that silently does nothing.
- The six-outcome triage taxonomy from [ADR 0005](0005-copilot-reviewer-loop.md) (FIX / REJECT / DISCUSS / DEFER / NOISE / HUMAN-PAUSE) should be shared vocabulary across functions so Discussions and Issues stay consistent.

## Considered Options

- **Option A: one theme key.** Single setting like `orchestrator: claude`. Clean, but can't express "mostly Claude, but Copilot for PR reviews."
- **Option B: flat list of per-function handlers.** Every function names its handler; no default. Verbose; changing the whole agency means rewriting N lines.
- **Option C** *(this ADR)*: **cascade — one default, per-function overrides**. Like CSS: set `--orchestrator: claude`, override slots where needed. Easy to read one-line configs and easy to do surgical overrides.

## Decision Outcome

Chosen: **Option C**, cascading defaults.

### The schema

```yaml
orchestrator:
  # Default handler for any function not listed below.
  default: claude

  # Per-function overrides. Each function is a "slot" you can override.
  slots:
    bug-reports: claude          # subset of issues; same mechanism
    issues: claude
    discussions: claude
    documentation: claude
    pr-prep: claude
    pr-reviews:                  # multi-handler slot (see below)
      - copilot                  # GitHub reviewer (the only assignable AI)
      - claude-preflight         # skill-based pre-PR review during pr-prep
```

Terse form for "whole agency" configs:

```yaml
orchestrator:
  default: claude
  # pr-reviews is not inherited from default. It has a built-in default of
  # [copilot] because Copilot is the only AI that can be assigned via
  # requested_reviewers (see "Mechanism rail" below). Override explicitly
  # under orchestrator.slots.pr-reviews to extend or replace the list.
```

`pr-reviews` is the one slot the cascade does *not* apply to by default. The `default:` key covers `bug-reports`, `issues`, `discussions`, `documentation`, and `pr-prep`; `pr-reviews` gets a schema-provided default of `[copilot]` and is only changed via an explicit `orchestrator.slots.pr-reviews` override. `pr-triage` is not a slot at all (see below).

### The seven functions (slots)

| Slot | What it covers | Default handler mechanism |
|---|---|---|
| `bug-reports` | Subset of `issues`. Labeled / templated as bug. | `@mention` or skill on issue open. |
| `issues` | Non-bug issue intake, triage, cross-linking. | `@mention` or skill on issue open. |
| `discussions` | Answering / routing GitHub Discussions. | `@mention` or skill on discussion create. |
| `documentation` | Doc PRs opened against `docs/` or `llm-wiki/`. | Skill invoked by `scaleforce[bot]`. |
| `pr-prep` | Pre-PR work: branch creation, commit crafting, draft PR body, optional pre-review. | Skill or action before PR opens. |
| `pr-reviews` | Post-PR-open review by the reviewer cast. | Copilot assigned via `requested_reviewers`; other reviewers run as skills. See [ADR 0005](0005-copilot-reviewer-loop.md). |
| *(not a slot)* `pr-triage` | Routing incoming PR events, requesting reviews, applying labels, dispatching to `pr-reviews`. | **Inherent to `scaleforce[bot]`** — not delegated. |

Two intentional choices above:

1. **`bug-reports` is a subset of `issues`**, not a sibling. It's kept as its own slot because bug triage often warrants a different handler (e.g. Copilot if bugs are typically in code; Claude if they're typically in docs or UX). Default is to inherit `issues`.
2. **`pr-triage` is not a slot.** It's `scaleforce[bot]`'s own job — parsing webhook events, applying labels, requesting reviews, dispatching to the `pr-reviews` cast. Making it overridable would mean letting another agent take over ScaleForce's role, which is a different decision.

### The `pr-reviews` slot is a list, not a scalar

Because:

- GitHub only allows **one** AI App (Copilot) as a `requested_reviewers` entry. Other agents can review but not via that mechanism.
- Pre-PR reviews (running Claude's code review skill during `pr-prep`) are still "reviews" in the workflow sense — they should appear in the cast.
- Future additions (a second reviewer App, a human-gate bot) should be add-a-line.

Schema allows:

```yaml
orchestrator:
  slots:
    pr-reviews:
      - copilot              # GitHub-reviewer mechanism; the recursive loop from ADR 0005
      - claude-preflight     # skill mechanism; runs in pr-prep before PR opens
```

`scaleforce[bot]` consults the list and dispatches each entry through its declared mechanism. The `copilot` entry triggers the loop described in [ADR 0005](0005-copilot-reviewer-loop.md).

### Mechanism rail — what each handler name resolves to

| Handler name | Mechanism | Valid slots |
|---|---|---|
| `claude` | `@mention` of `@claude` + Claude Code Action workflow | all except `pr-reviews[reviewer]` |
| `claude-preflight` | Skill run during `pr-prep` (no `@mention`) | `pr-reviews` only (as preflight) |
| `copilot` | `requested_reviewers` + `pull_request_review` webhook loop | `pr-reviews` only (GitHub constraint) |
| `maintainer` | Ping `@thomHayner` | all |
| *(future)* `codex` | `@codex` mention or dedicated action | all except `pr-reviews[reviewer]` until GitHub whitelists |

Constraint enforcement: `scaleforce[bot]` rejects config that puts a non-assignable handler into `pr-reviews` as a reviewer entry (would silently no-op at runtime otherwise). Preflight entries are fine regardless of App whitelisting since they don't touch `requested_reviewers`.

**Actor provenance**: every handler runs its mechanism under the handler's own installation / app token — Claude writes post as `claude[bot]`, Copilot's reviewer output is `copilot-pull-request-reviewer[bot]`, dispatcher/orchestration writes are `scaleforce[bot]`. The dispatcher never proxies a handler's output under the maintainer PAT. See [ADR 0003 § Actor provenance invariant](0003-bot-identity-separation.md#actor-provenance-invariant).

### Shared vocabulary across slots

All slots that produce structured output (issues triage, PR reviews, discussions) use the same six-outcome taxonomy from [ADR 0005](0005-copilot-reviewer-loop.md):

**FIX / REJECT / DISCUSS / DEFER / NOISE / HUMAN-PAUSE**

That means an issue triaged with `DEFER` looks, in its metadata, the same as a PR-review comment triaged `DEFER`. Downstream automation (labels, Discussions, dashboards) can key off one taxonomy instead of per-slot jargon.

### Approval authority — does not move

No handler in the schema can issue an `APPROVED` review. Branch protection approvals remain humans-only. The schema names *who runs the work*, not *who approves the merge*. This is intentional and explicit so a user reading the config doesn't assume "I set `pr-reviews: copilot` and now Copilot can approve merges."

### Consequences

- Good: a new agent joins by adding a row to the mechanism table and optionally a slot override. No code change in the router.
- Good: "whole-agency" configs stay one line; surgical overrides stay readable.
- Good: shared FIX/REJECT/DISCUSS/DEFER/NOISE/HUMAN-PAUSE vocabulary prevents divergent per-slot languages and keeps Discussions/Issues consistent.
- Good: GitHub constraint (only Copilot can be `requested_reviewers`) is encoded in validation rather than tribal knowledge.
- Bad: two rails (dispatch + mechanism) mean there are two places a misconfiguration can happen. Mitigation: validation, and the mechanism table lives in-repo so it's versioned with the router.
- Bad: `pr-triage` being non-overridable is a design opinion. If a user ever wants another orchestrator bot to take over, they'd fork this ADR — that's the right bar for that decision.
- Neutral: when GitHub loosens the `requested_reviewers` whitelist (unlikely soon), the mechanism table gets new rows; nothing else changes.

## Pros and Cons of the Options

### Option A: one theme key
- Good: simplest possible config. Great when the agency is homogeneous.
- Bad: no expressive way to mix — "Copilot for PR reviews, Claude for everything else" forces you out of the schema.

### Option B: flat per-function map
- Good: explicit; no implicit inheritance.
- Bad: verbose. Swapping the whole agency means rewriting N slots.
- Bad: no obvious place to say "everything not listed goes here."

### Option C: cascade (chosen)
- Good: combines A's brevity for homogeneous cases with B's expressiveness for mixed ones.
- Good: mirrors how design tokens and CSS custom properties work — familiar mental model.
- Bad: users have to know the default-plus-override pattern. Mitigated by the config being small (7 slots).

## More Information

- [ADR 0003](0003-bot-identity-separation.md) — identity separation; mechanism-rail handler names map to these logins.
- [ADR 0005](0005-copilot-reviewer-loop.md) — the `pr-reviews[copilot]` loop contract (terminal-state invariant, triage taxonomy, non-convergence rule).
- [`copilot-recursive-review`](https://github.com/thomHayner/ai-skill-builder-library) skill — authoritative definition of the `pr-reviews[copilot]` mechanism.
- [ADR 0002](0002-use-feature-dev-main-branch-model.md) — branch model; clarifies that human approval is the merge gate regardless of routing.
