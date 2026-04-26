# 0008. Engineering is the branch; scaleforce[bot] is its GitHub instrument

- **Status**: proposed
- **Date**: 2026-04-22
- **Deciders**: @thomHayner
- **Tags**: tree-position, bots, orchestration, scope

## Context and Problem Statement

Earlier ADRs ([0003](0003-bot-identity-separation.md), [0005](0005-copilot-reviewer-loop.md), [0007](0007-github-function-routing.md)) describe `scaleforce[bot]` from the inside — how it posts, how it routes, how it runs the Copilot review loop. They do not say *where it sits in the agency tree* or *who invokes it*. That framing worked while the tree was a single node. It stops working as soon as honeycrisp (Chief-of-Staff router) and sibling domain branches (PersonalOS, Agency, and an Engineering branch) become real.

A direct question surfaced the ambiguity: *if scaleforce is described as "just a router" with no domain opinions, is it really a peer branch alongside PersonalOS and Agency, or is it an instrument that a real Engineering branch uses?*

Applying the test used for other branches: **does it have domain knowledge and opinions?**

- PersonalOS has opinions about *time* — calendars, reminders, attention.
- Agency has opinions about *people* — customers, team, CRM state.
- A real Engineering branch would have opinions about the *codebase* — architectural preferences, convention, ownership, change propagation.

`scaleforce[bot]` has none of those. Its expertise is *how GitHub works* — webhooks, identities, fan-out mechanics, terminal states, review-loop state. Those are facts-about-the-instrument, not facts-about-the-user's-engineering. scaleforce is a **GitHub expert**, not an **engineering expert**.

## Decision Drivers

- Each branch of the tree is capped at a 6–10 sub-concern fan-out budget; "scaleforce" and "Engineering" as peers would double-count the engineering slot and waste a branch.
- Cross-repo synthetic moderation (choosing between legitimate conflicting repo positions) requires codebase reasoning. Assigning that to scaleforce was always a scope violation — the charter's "multiplex-not-moderate" rule is the symptom, not the solution.
- scaleforce needs someone *above* it in the tree to direct fan-out, approve novel classifications, and moderate synthetic decisions. A peer branch has no one to hand those to except honeycrisp, which is the wrong altitude — honeycrisp is cross-domain, not engineering-specific.
- Per-repo wiki-agents already exist as sub-concerns of "the engineering domain." They need a branch home; "scaleforce's neighbors" is not that home because scaleforce is an instrument, not a domain owner.
- The instrument framing matches how PersonalOS uses its Gmail/Calendar MCPs and how Agency uses its CRM MCP. Symmetry across the tree is easier to reason about than a special case.

## Considered Options

- **Option A: scaleforce as a peer branch** alongside PersonalOS, Agency, etc. The original framing. Leaves no branch owner for per-repo wiki-agents and forces scaleforce to either do synthetic reasoning (scope violation) or refuse it (leaves no one to do it).
- **Option B: scaleforce as Engineering's instrument; Engineering is the branch.** Engineering owns the domain and the 6–10 sub-concern budget; scaleforce implements Engineering's GitHub-surface operations. Per-repo wiki-agents are Engineering's sub-concerns, invoked through scaleforce as the fan-out instrument.
- **Option C: fold scaleforce directly into Engineering** as the LLM-wiki's own execution tool, no separate identity. Rejected — breaks [ADR 0003](0003-bot-identity-separation.md), kills the GitHub-level audit trail, and conflates reasoning with execution.

## Decision Outcome

Chosen: **Option B.**

**Engineering is the branch.** It is an LLM-wiki at the tree level, peer to PersonalOS, Agency, and the other domain branches under honeycrisp. Engineering reasons about the user's codebase across all repos: architectural calls, ownership, convention, cross-repo decisions, priority-across-the-engineering-queue, novel classification, synthetic moderation.

**`scaleforce[bot]` is Engineering's GitHub instrument.** It provides the fast, deterministic GitHub-surface layer that Engineering uses to execute. Its domain is GitHub end-to-end — webhooks, writes, loops, scaffolding, identity enforcement, the notification-gap sweep — and its thesis is deterministic-fast-path-with-narrow-templated-LLM-classification-where-unavoidable (see [ADR 0005 § Classifier boundary](0005-copilot-reviewer-loop.md#classifier-boundary)).

### What moves where

| Concern | Owner | Notes |
|---|---|---|
| Codebase reasoning, architectural judgment | Engineering | Always. Never scaleforce. |
| Which repos are in scope for a cross-repo question | Engineering (novel/ambiguous) or scaleforce (deterministic refs) | See [ADR 0009](0009-ordered-cross-repo-deliberation.md) for the split. |
| Synthetic moderation of cross-repo conflicts | Engineering | scaleforce does mechanical moderation only. |
| Mechanical moderation (agreement detection, tie-breaker rules, vote counts, duplicate consolidation) | scaleforce | Configured rules; no reasoning required. |
| Routing policy (which handler owns which slot) | Config, authored by Engineering or the maintainer | scaleforce *implements*. See [ADR 0007](0007-github-function-routing.md). |
| Routing execution | scaleforce | Read the table, dispatch. |
| Review-loop orchestration | scaleforce | [ADR 0005](0005-copilot-reviewer-loop.md). |
| Scaffolding and convention enforcement | scaleforce | Templates in the orchestrator repo; scaleforce propagates. |
| Notification-gap monitoring | scaleforce | Issues, Discussions, Projects, stale PRs — scheduled sweeps. |
| Per-repo wiki-agent invocation | scaleforce, directed by Engineering | Engineering names the targets; scaleforce carries the packets. |

### scaleforce is a long-running deterministic instrument, not a passive MCP

scaleforce is more active than a typical MCP. It wakes on webhooks, runs bounded autonomous loops (review loops, cross-repo deliberation turn-taking, notification sweeps), maintains state on PRs between events, and calls back to Engineering at decision points rather than being re-invoked step-by-step. Classifying it as an instrument does not imply passivity — it implies *who directs it* and *who owns the reasoning*. Engineering kicks off a loop; scaleforce runs it to terminal state, asking Engineering for judgment only when a classification falls outside the narrow-templated-LLM budget.

### Consequences

- Good: clears the ambiguity in [ADR 0003](0003-bot-identity-separation.md), [ADR 0005](0005-copilot-reviewer-loop.md), and [ADR 0007](0007-github-function-routing.md) about who scaleforce answers to.
- Good: per-repo wiki-agents have a branch home (Engineering's sub-concerns) without creating a new peer slot in the tree.
- Good: scaleforce's fan-out budget (six ADR 0007 slots + pr-triage) stops being a tree-level concern and becomes an instrument-capacity concern — different conversation, lower stakes.
- Good: symmetry with how PersonalOS uses Gmail/Calendar MCPs and Agency uses its CRM MCP. Instrument/branch is now the consistent pattern across the tree.
- Good: enables [ADR 0009](0009-ordered-cross-repo-deliberation.md) — the ordered-cross-repo-deliberation protocol needs a synthetic moderator, which is Engineering, which this ADR names.
- Bad: the existing ADRs read slightly awkwardly until they're touched up. [ADR 0003](0003-bot-identity-separation.md) is revised in the same PR to add two-layer actor provenance (GitHub identity + upward event-log identity); [ADR 0005](0005-copilot-reviewer-loop.md) is revised to add the classifier-boundary section.
- Neutral: Engineering's internal structure (which sub-concerns, which per-repo wiki-agents, how it stores knowledge) is out of scope for this ADR. This ADR names the role, not the implementation.

## Pros and Cons of the Options

### Option A: scaleforce as peer branch
- Good: matches how I initially described scaleforce; nothing moves.
- Bad: no synthetic moderator above it. Every cross-repo conflict escalates to honeycrisp or the maintainer, which is the wrong altitude.
- Bad: per-repo wiki-agents have no branch home.
- Bad: invites scope creep — a peer branch that "just routes" is already fighting gravity.

### Option B: scaleforce as Engineering's instrument (chosen)
- Good: clean split between reasoning (branch) and execution (instrument).
- Good: symmetric with other branches' instrument patterns.
- Good: per-repo wiki-agents, scaffolding convention, notification-sweep policy all have a natural owner.
- Bad: requires revisions to existing ADRs (0003, 0005) to align. Done in the same PR.

### Option C: fold scaleforce into Engineering
- Good: single node instead of two; simplest.
- Bad: destroys [ADR 0003](0003-bot-identity-separation.md)'s actor-provenance invariant — GitHub writes can't distinguish "Engineering reasoned" from "Engineering dispatched a webhook handler."
- Bad: conflates reasoning latency with execution latency; the deterministic fast-path thesis disappears.
- Bad: GitHub App scoping becomes a mess (an LLM-wiki branch isn't a GitHub App).

## More Information

- [Charter](../CHARTER.md) — the drop-in scope statement this ADR backs.
- [ADR 0003](0003-bot-identity-separation.md) — GitHub-level identity separation; revised in the same PR for tree-level two-layer attribution.
- [ADR 0005](0005-copilot-reviewer-loop.md) — Copilot review loop; revised in the same PR to add the classifier-boundary section.
- [ADR 0007](0007-github-function-routing.md) — slot routing; this ADR clarifies that routing *policy* is Engineering's (expressed in config) while routing *execution* is scaleforce's.
- [ADR 0009](0009-ordered-cross-repo-deliberation.md) — ordered cross-repo deliberation protocol; depends on this ADR for the synthetic-moderator role.
- Related reading for the instrument-vs-branch pattern:
  - LangGraph multi-agent supervisor / hierarchical teams — https://langchain-ai.github.io/langgraph/tutorials/multi_agent/hierarchical_agent_teams/
  - AutoGen AgentChat teams — https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html
  - CrewAI processes — https://docs.crewai.com/concepts/processes
