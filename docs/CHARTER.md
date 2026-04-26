# scaleforce[bot] — Scope Charter

- **Status**: draft
- **Date**: 2026-04-22
- **Maintainer**: @thomHayner
- **Companion ADRs**: [0003](adr/0003-bot-identity-separation.md), [0005](adr/0005-copilot-reviewer-loop.md), [0007](adr/0007-github-function-routing.md), [0008](adr/0008-engineering-branch-scaleforce-instrument.md), [0009](adr/0009-ordered-cross-repo-deliberation.md)

The minimal high-level statement of what scaleforce[bot] is, what it is not, and which neighbors it defers to for which functions. ADRs encode the individual decisions that back this charter. Read this first; drop into an ADR when a specific decision needs stress-testing.

## Position in the tree

**scaleforce[bot] is the GitHub instrument of the Engineering branch.** It is not a branch. See [ADR 0008](adr/0008-engineering-branch-scaleforce-instrument.md) for the decision and its drivers.

The agency tree has branches that *reason* — honey-claw (executive), honeycrisp (Chief-of-Staff router), and domain branches including PersonalOS (time), Agency (people), and Engineering (codebase). Each branch is an LLM-wiki that owns its domain and stays inside the 6–10 sub-concern fan-out budget. Engineering is the engineering branch; its sub-concerns include per-repo wiki-agents, the release process, architectural themes, and third-party integrations.

scaleforce is to Engineering what a Gmail MCP is to PersonalOS or a CRM MCP is to Agency: the instrument through which the branch operates its external surface. The external surface, in Engineering's case, is GitHub — so scaleforce's domain is GitHub, end-to-end.

One caveat: scaleforce is more active than a typical MCP. It runs bounded autonomous loops on webhooks (review loops, scheduled sweeps), maintains state on PRs between events, and calls back to Engineering at decision points rather than being re-invoked step-by-step. It is a **long-running deterministic instrument** — a daemon tool, not a request/response one.

## Thesis

**scaleforce is the deterministic fast-path for GitHub.** It replaces LLM-latency with Probot-latency for anything on GitHub that has a stable, nameable route or a rule-based answer. Agents are slow, non-deterministic, expensive; scaleforce is fast, deterministic, cheap. The branch wins by *never* invoking an LLM when a lookup, a webhook dispatch, a permission check, a rule, or a config-driven route will do.

Narrow templated LLM calls are allowed inside scaleforce for **classification from free text** (e.g., extracting multi-repo scope from prose when labels are absent, or parsing a Copilot thread into a six-outcome bucket). These calls must be structured, bounded, cacheable, and have deterministic fallbacks. They are not reasoning; they are reading comprehension wrapped in a schema. See [ADR 0005 § Classifier boundary](adr/0005-copilot-reviewer-loop.md#classifier-boundary) for where such calls are permitted.

The dividing line, whenever a boundary is unclear:

- **"Can this decision be made by a rule, a count, a lookup, or a configured tie-breaker?"** → scaleforce does it with Probot tools.
- **"Does this decision require reading comprehension on free text to produce a structured classification?"** → narrow templated LLM call inside scaleforce is permitted.
- **"Does this decision require codebase knowledge or reasoning about the user's engineering?"** → hand to Engineering.

## What scaleforce does

Primary responsibilities, all deterministic except where flagged:

1. **Review loop orchestration** ([ADR 0005](adr/0005-copilot-reviewer-loop.md)). Request reviews from Copilot, poll for review arrival, triage threads into the six-outcome taxonomy (triage-to-bucket classification is the allowed narrow-LLM case), apply FIXes via handlers, open Discussions for DISCUSS and Issues for DEFER, reply on and resolve threads, re-request review on new HEAD, detect non-convergence.
2. **Cross-repo deliberation machinery** ([ADR 0009](adr/0009-ordered-cross-repo-deliberation.md)). When Engineering identifies a question as multi-repo, scaleforce fans out to the named repo-wiki-agents, enforces ordered turn-taking (one agent at a time, within configured bounds per round), collects responses, posts structured round summaries, signals the moderator between rounds. Termination is convergence or pathology; there is no fixed round cap. Pathology is ADR 0005's "same class of thread recurring with no progress for 3 rounds." A hard backstop at ~25 rounds exists only for runaway protection in unattended loops — it is a tripwire, not a normal terminator.
3. **Mechanical moderation.** Within cross-repo deliberation, scaleforce may moderate *mechanical* decisions — detecting unanimous agreement, applying a configured tie-breaker rule (e.g., "frontend wins on UX calls, backend wins on data-model calls"), consolidating duplicate concerns by keyword overlap, counting votes. Synthetic moderation — choosing between legitimate conflicting positions — is always Engineering's.
4. **Scaffolding and convention enforcement.** Repo setup (labels, issue templates, PR templates, branch protections per [ADR 0002](adr/0002-use-feature-dev-main-branch-model.md)), ADR scaffolding (consistent MADR templates across repos), llm-wiki skeleton enforcement, drift detection against convention, and opening PRs against repos that have fallen out of convention. Templates live in the orchestrator repo and are propagated outward.
5. **Notification-gap monitoring.** GitHub's notification surface covers PR review requests and Dependabot alerts reasonably but leaves gaps. scaleforce periodically sweeps: open issues across projects (not surfaced in notifications), Discussions without an `@mention` (also unsurfaced), stale PRs, unanswered review threads, and **GitHub Projects state — stalled items, iteration-health issues, orphaned drafts, and missing-field drift**. Projects is a fourth gap because its native notifications cover assignment only, not field changes, status moves, or iteration rollovers.
6. **Routing implementation** ([ADR 0007](adr/0007-github-function-routing.md)). The dispatch table lives in `orchestrator.default` and `orchestrator.slots.*` config. scaleforce reads it and executes — it does not choose the routing.
7. **Agent-event emission (the upward contract).** Every orchestration decision emits a structured event ([ADR 0006](adr/0006-llm-observability.md) schema). Once honeycrisp exists, these events are the contract by which upstream agents know what scaleforce is doing. Event types extend as new functions are added; the log is never scraped around.

## What scaleforce does NOT do

- **Does not author code.** Every authoring write is attributable to a handler (claude[bot], copilot-swe-agent[bot], future codex). scaleforce commits only scaffolding/templating output, and even then only as PRs, never as direct pushes.
- **Does not reason about the codebase.** No architectural judgment, no feature-ownership calls, no "should we do X" decisions. Those are Engineering's.
- **Does not synthesize across repos or across domains.** Fan-out yes; merge no. Side-by-side "frontend said X, backend said Y" is scaleforce; "the right answer is Z because..." is Engineering or honeycrisp.
- **Does not choose routing policy.** Policy is config; scaleforce executes. Changing policy is a PR, reviewed by the maintainer.
- **Does not cache wiki-agent answers** across events, paraphrase them, or override them. The repo-wiki-agent is authoritative for its repo.
- **Does not call third-party APIs outside the GitHub surface.** Sentry, Vercel, Supabase etc. are consumed through their GitHub comments and check-runs. Their own APIs belong to other branches.
- **Does not reach into non-GitHub task systems** (ClickUp, Linear outside its GitHub integration, etc.). GitHub Projects is in scope because it is GitHub-surface; non-GitHub task systems are another branch's instrument.
- **Does not invoke an LLM when a lookup, a rule, or a config value answers the question.** Thesis violation.
- **Does not accept runtime directives from sibling branches.** PersonalOS, Agency, and honeycrisp interact with scaleforce's domain *through the same GitHub surfaces a human uses* — open an issue, open a PR, comment on a thread. No side-channel APIs.
- **Does not mutate its own routing config at runtime.** Declarative in-repo; changes go through PR.
- **Does not make policy out of patterns.** If a classification pattern recurs, that's a config change Engineering proposes — scaleforce doesn't promote observed behavior to policy on its own.

## Neighbors and handoffs

| Neighbor | What they own that scaleforce must not do | What scaleforce owns that they must not do | Handoff mechanism |
|---|---|---|---|
| **Engineering (branch)** | Codebase reasoning, synthetic moderation, cross-repo decisions, architectural calls, novel classification | All GitHub-surface operations, loop state, notification sweeps, scaffolding | Engineering directs via config + in-thread directives; scaleforce reports via event log |
| **honeycrisp (Chief of Staff)** | Cross-domain synthesis, priority filtering, upward summarization | GitHub-internal orchestration; all GitHub writes | Event log upward; no direct RPC; downward direction via GitHub surfaces only |
| **honey-claw (executive)** | Prioritization across branches | GitHub execution | Via honeycrisp; never direct |
| **PersonalOS** | Time, calendar, attention | Code state on GitHub | Disjoint; if correlation needed, honeycrisp mediates |
| **Agency** | People, customers, CRM | Code state on GitHub | Disjoint; context (e.g., "priority customer") enters via GitHub labels/fields, not API |
| **claude[bot]** | Code authoring, substantive review, spec/ADR drafting, answering `@claude` pings | Triage, routing, loop orchestration, identity enforcement | `@claude` mention in a thread scaleforce has prepared; scaleforce never authors on claude's behalf |
| **copilot-pull-request-reviewer[bot]** | PR review output | Reviewer assignment, loop state, thread triage | `requested_reviewers` API; `pull_request_review` webhook |
| **copilot-swe-agent[bot]** | Coding-agent PR authoring (when enabled) | Nothing scaleforce-specific | Issue assignment |
| **per-repo wiki-LLM agents** | Repo-local knowledge and judgment | All GitHub-facing plumbing for that repo | Invoked by scaleforce during fan-out; their output is their own identity |
| **Third-party agents** (Sentry, Vercel, Supabase, CodeRabbit, Renovate, etc.) | Their domain-specific analysis | GitHub-surface triage of their output | Via GitHub comments and check-runs only; scaleforce does not call their APIs |
| **Non-GitHub task systems** (ClickUp, etc.) | Their own task/time/project management | Nothing GitHub-side | Out of scope; handled by another branch's instrument |
| **Maintainer** | Approvals, merges, overrides, HUMAN-PAUSE resolutions | Everything else automatable | `HUMAN-PAUSE` surfaces; direct `@thomHayner` ping when necessary |

## Actor provenance — two-layer attribution

[ADR 0003](adr/0003-bot-identity-separation.md#actor-provenance-invariant)'s invariant holds: every GitHub write is attributable at the GitHub level to the identity that performed it — scaleforce[bot] for orchestration writes, claude[bot] for AI code work, the reviewer's identity for review output, the maintainer's identity only for explicit human decisions.

At the tree level, a second layer applies (see [ADR 0003 § Tree-level attribution](adr/0003-bot-identity-separation.md#tree-level-attribution-upward-identity)): **the upward event log attributes reasoning to the reasoner.** If Engineering directed scaleforce to fan out across four repos, the GitHub post is scaleforce[bot]'s but the event log entry records Engineering as the decision-maker. honeycrisp's summaries of scaleforce activity are attributed to honeycrisp, not to scaleforce. The maintainer PAT is never a fallback at either layer.

## Fan-out budgets

- **Slot-level** (dispatch): the six [ADR 0007](adr/0007-github-function-routing.md) slots (bug-reports, issues, discussions, documentation, pr-prep, pr-reviews) plus inherent pr-triage. New slots require consolidation or a branch split, not expansion — the current count sits at the top of the budget.
- **Cross-repo-level**: per deliberation, bounded by the tree's 6–10 rule. A question that genuinely touches more than ~10 repos is `HUMAN-PAUSE` on principle — no agent should decide that broadly in one pass.
- **Handler-level**: no built-in cap, but mechanism rail validation ([ADR 0007](adr/0007-github-function-routing.md#mechanism-rail--what-each-handler-name-resolves-to)) ensures handlers only appear in slots where their mechanism works.

## Termination rules (single taxonomy across loops)

Any loop scaleforce runs terminates when **any** of these is true:

- **Convergence** — the loop's success condition is met (zero unresolved threads, unanimous agreement, scaffolding applied, etc.).
- **Maintainer intervention** — stop signal, takeover, or merge.
- **Pathology** — [ADR 0005](adr/0005-copilot-reviewer-loop.md#termination)'s "same class recurring with no progress for 3 rounds." Surfaced as `HUMAN-PAUSE`.
- **Hard backstop** — ~25 rounds, purely runaway protection for unattended loops. Should almost never fire.

There is no fixed productive-round cap. Seven-round converging loops are successes.

## Drift tripwires

Observable behaviors that mean scaleforce is wandering out of scope:

- An LLM is invoked where a lookup, a rule, or a config value would answer. → thesis violation.
- A slot appears in the config that isn't a GitHub function. → scope creep.
- A non-GitHub webhook or inbound API call from a sibling branch. → side-channel; upward contract has inverted.
- A commit shows scaleforce[bot] in any author field, even as co-author. → authoring code.
- An event appears in the log that's shaped like synthesis ("here's what's happening across your repos") rather than fact-shaped ("X happened in repo Y at time T"). → trying to be honeycrisp.
- A wiki-agent's answer is cached across events, or paraphrased in a later response. → becoming a wiki.
- A policy decision appears in the event log without a corresponding config change. → making policy from pattern.
- A cross-repo moderation output merges positions ("the right call is Z") rather than assembling them side-by-side. → synthetic moderation where scaleforce should have deferred to Engineering.
- A third-party-agent's own API gets called directly. → leaking into another branch.
- A non-GitHub task system appears in an event, config, or write path. → reaching past the GitHub surface.

## Tripwire review cadence

Each tripwire gets an event type in [ADR 0006](adr/0006-llm-observability.md)'s schema. A scheduled sweep counts occurrences and flags upward via honeycrisp if any tripwire fires unexpectedly. The charter isn't real unless violations are observable.
