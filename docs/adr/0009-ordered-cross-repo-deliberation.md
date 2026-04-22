# 0009. Ordered cross-repo deliberation: turn-taking, convergence-or-pathology, mechanical vs synthetic moderation

- **Status**: proposed
- **Date**: 2026-04-22
- **Deciders**: @thomHayner
- **Tags**: orchestration, cross-repo, multi-agent, moderation

## Context and Problem Statement

Some questions touch multiple repos — a distributed-monorepo case where frontend, backend, a service, and a feature repo each own a piece of the answer. Each repo has its own wiki-LLM agent ([ADR 0008](0008-engineering-branch-scaleforce-instrument.md) names per-repo wiki-agents as sub-concerns of the Engineering branch). When a Discussion or issue needs input from 2–3 of them, the naive pattern is to fan out in parallel and collect answers.

Parallel fan-out is the wrong primitive. Observed failure modes:

- **Content dumps.** Each agent answers from its own full context without seeing the others' concerns. The aggregated output is N unrelated essays, not a deliberation.
- **Duplicate concerns.** Two agents independently raise the same worry with slightly different framing. The consumer has to dedupe.
- **Conflict without structure.** When agents disagree, there's no structured path from "we disagree" to "here's a decision or a named blocker."
- **No convergence signal.** Parallel collection has no natural terminator except a timeout. Loops don't converge; they expire.

A better pattern is ordered turn-taking with a moderator, bounded per round, continued until convergence or pathology. `scaleforce[bot]` is well-suited to the *machinery* of this protocol (turn order, round bounds, collection, posting structured summaries, detecting pathology) but not to the *synthetic judgment* of moderating the deliberation itself. [ADR 0008](0008-engineering-branch-scaleforce-instrument.md) places scaleforce as Engineering's instrument; that split lets Engineering play the moderator while scaleforce plays the turn-taking machinery.

## Decision Drivers

- Multi-agent deliberation is a known pattern in the literature (LangGraph supervisor, AutoGen GroupChatManager, CrewAI hierarchical process). Reinventing it badly is unnecessary; adapting an ordered-turn-taking protocol is not novel.
- The [ADR 0005](0005-copilot-reviewer-loop.md) non-convergence rule (pattern-based, not counter-based) generalizes — the same signal is what catches a stuck deliberation across repos.
- Scaleforce's identity as a fast deterministic instrument means turn-taking, round bounds, and summary assembly belong to it; synthetic decisions belong to Engineering.
- Round caps are the wrong primary terminator. Productive deliberations can run 5–10 rounds and resolve; unproductive ones get stuck in 2. Pattern detection is the real signal; a hard cap is only a runaway-protection tripwire.
- Per-round bounds on *agent output* (concerns per round, words per concern) are load-bearing — without them, the first agent dumps everything and the rest react to a wall of text.

## Considered Options

- **Option A: parallel fan-out.** Collect in parallel, scaleforce aggregates side-by-side, Engineering synthesizes once. The starting point; fails on duplicates, conflicts, and convergence.
- **Option B: ordered turn-taking, bounded per round, unlimited rounds until convergence or pathology** (chosen). Each agent goes in a determined order within a round, sees prior agents' output in that round, produces bounded output. Moderator synthesizes between rounds. Termination = convergence OR pathology; no fixed round cap; hard backstop at ~25 rounds for runaway protection.
- **Option C: full group-chat free-for-all** (AutoGen-style open `GroupChatManager` with a speaker-selection LLM). Powerful but hard to bound; speaker selection is itself synthetic reasoning that Engineering would have to own. Rejected as heavier than needed for the distributed-monorepo case.
- **Option D: tournament / pairwise** (agents argue pairwise, winners advance). Over-engineered for 2–4-repo questions.

## Decision Outcome

Chosen: **Option B.**

### The protocol

**Phase 0 — Scoping.** Engineering (or scaleforce on deterministic references like `owner/repo#123` and explicit labels) identifies the set of participating repos. If the classification is ambiguous or novel, it escalates to Engineering rather than guessing ([ADR 0005 § Classifier boundary](0005-copilot-reviewer-loop.md#classifier-boundary)). The output is an ordered list of participants (alphabetical by repo name, or by CODEOWNERS priority, or by who was tagged first — the ordering is configurable but deterministic).

**Phase 1 — Round 1: Concerns (bounded).** scaleforce posts the packet to each repo-wiki-agent with an explicit bound: configurable caps (default: ≤3 concerns, ≤200 words each, no recommendations yet). Agents respond **one at a time in the determined order** — scaleforce holds back agent N+1 until agent N has posted. Each agent sees the prior agents' concerns before speaking, which kills redundancy.

**Phase 2 — Moderator pass.** A moderator synthesizes the concerns and either:

- (a) **proposes a tentative decision** with rationale, or
- (b) **identifies what cannot yet be decided** and asks a targeted follow-up of one or more specific agents.

The moderator is **Engineering** by default. honeycrisp may substitute if Engineering is absent; the maintainer may substitute for either.

scaleforce does NOT play moderator here — moderation is synthetic (see Mechanical vs synthetic split below).

**Phase 3 — Round 2+: Reactions.** scaleforce posts the moderator's output back to each agent, in the same ordering, with the same per-round bounds. Each agent agrees / objects / refines against the moderator's proposal. Agents see prior agents' reactions before speaking.

**Phase 4 — Convergence check.** After each round:

- **Converged** if all agents agree with the moderator's current proposal, or if remaining objections are explicitly within the moderator's acceptable scope.
- **Continue** if new concerns surfaced that the moderator wants to take another pass on.
- **Pathology** (see below) if the loop is stuck.

On convergence: scaleforce posts a final structured summary, labels the Discussion/issue `cross-repo-converged`, and hands off to the relevant handler or the maintainer.

### Termination — convergence, pathology, or runaway backstop

Termination follows the same taxonomy as [ADR 0005](0005-copilot-reviewer-loop.md#termination):

- **Convergence** — per above.
- **Maintainer intervention** — stop signal, takeover, explicit decision.
- **Pathology** — "same class of concern recurring with no progress for 3 rounds in a row." Reuses [ADR 0005](0005-copilot-reviewer-loop.md#termination)'s non-convergence rule, applied at the deliberation-class level rather than the thread-class level. Triggers `HUMAN-PAUSE`.
- **Hard backstop** at ~25 rounds, purely runaway protection for unattended deliberations. Triggers `HUMAN-PAUSE`. Should almost never fire; if it does, either the pathology detector is too lenient or the bounds-per-round are too loose.

**There is no fixed productive-round cap.** A deliberation that runs 7 productive rounds and resolves is a success. Round count is telemetry, not a terminator.

### Mechanical vs synthetic moderation — the split

scaleforce may do **mechanical moderation**:

- **Agreement detection** — all agents' Round-N responses match by a deterministic comparator.
- **Duplicate consolidation** — agents raised concerns with high keyword overlap; collapse into one bullet in the round summary.
- **Vote counts** — when a configured majority-rules tie-breaker applies.
- **Configured tie-breaker rules** — e.g., "frontend wins on UX calls, backend wins on data-model calls"; scaleforce recognizes the class of call from labels and applies the rule.
- **Bound enforcement** — rejecting an agent's output for exceeding the round's concern/word caps, with a templated ask to retry.

scaleforce may NOT do **synthetic moderation**:

- Choosing between legitimate conflicting positions based on codebase judgment.
- Deciding whether a tentative proposal adequately addresses a concern.
- Extending scope ("maybe we should also consider…").
- Writing the rationale for a decision.

Synthetic moderation is always Engineering's, even if scaleforce's internal classifier *could* produce a plausible answer. The classifier boundary ([ADR 0005 § Classifier boundary](0005-copilot-reviewer-loop.md#classifier-boundary)) permits classification from free text into a fixed taxonomy; moderation is not that.

### Fan-out budget

- **≤ 10 repos per deliberation.** A question that genuinely touches more than 10 repos is `HUMAN-PAUSE` on principle; no agent (or moderator) should decide that broadly in one pass. This matches the tree's 6–10 rule at the deliberation level.
- Within a deliberation, ordering is determined in Phase 0 and held stable across all rounds. No mid-deliberation reordering.

### Actor provenance (two-layer)

Every round-summary post is written under `scaleforce[bot]`'s installation token (GitHub layer). The moderator's rationale, when it appears in a summary, is attributed in the summary body to its author (Engineering, honeycrisp, or the maintainer) and in the [ADR 0006](0006-llm-observability.md) event log's `decided_by` field. Agents' outputs are attributed to their own repo-wiki-agent identity. See [ADR 0003 § Tree-level attribution](0003-bot-identity-separation.md#tree-level-attribution-upward-identity).

### Event-log shape

Each phase emits a structured event:

- `deliberation_opened` — scoping result, participant list, ordering, bounds.
- `round_started` — round index, phase (concerns | reactions).
- `agent_spoke` — per-agent, with classification of their output (concern / objection / refinement / agreement).
- `moderator_pass` — moderator identity, output type (tentative_decision | targeted_followup).
- `round_ended` — round index, convergence-check result.
- `deliberation_closed` — reason (converged | pathology | hard_backstop | maintainer).

honeycrisp's view of an in-flight cross-repo deliberation is assembled entirely from these events.

### Consequences

- Good: formalizes a pattern that was implicit and already drifting toward ad-hoc implementation.
- Good: reuses [ADR 0005](0005-copilot-reviewer-loop.md)'s pathology-detection rule at a new level, minimizing new vocabulary.
- Good: mechanical-vs-synthetic split gives a principled place to say no when scaleforce is tempted to reason.
- Good: bounded per-round output prevents content-dump failure mode.
- Good: hard backstop at ~25 rounds catches runaway loops without punishing productive ones.
- Bad: more machinery than the single-agent review loop; scaleforce's state model grows (per-deliberation state, per-round state, per-agent-turn state). Mitigation: state is derivable from the event log plus the Discussion/issue thread — stateless-per-event Probot still works.
- Bad: the moderator role creates a new always-on expectation on Engineering. Without Engineering, `honeycrisp` substitutes; without honeycrisp, the maintainer substitutes; otherwise the deliberation cannot proceed. Documented as acceptable.
- Neutral: ordering rule (alphabetical / CODEOWNERS / tagged-first) is configurable, not opinionated. Orgs can choose.

## Pros and Cons of the Options

### Option A: parallel fan-out
- Good: simplest to implement.
- Bad: content dumps, duplicate concerns, no structured conflict path, no convergence signal.

### Option B: ordered turn-taking, unlimited rounds until convergence or pathology (chosen)
- Good: each agent sees prior turns; reduces redundancy and reactivity.
- Good: pathology detection reuses [ADR 0005](0005-copilot-reviewer-loop.md)'s rule — one vocabulary.
- Good: productive long deliberations are not penalized.
- Bad: requires a moderator that can speak between rounds. Mitigated by Engineering being present by design.

### Option C: open group-chat with speaker-selection LLM
- Good: expressive; handles novel deliberation shapes.
- Bad: speaker-selection LLM is itself a synthetic reasoner inside scaleforce, which violates [ADR 0008](0008-engineering-branch-scaleforce-instrument.md).
- Bad: harder to bound; hard to detect pathology.

### Option D: pairwise tournament
- Good: deterministic ordering by construction.
- Bad: over-engineered for 2–4-repo questions; pairwise framing loses information when 3 agents need to converge on a single point.

## More Information

- [Charter](../CHARTER.md) — item 2 of "What scaleforce does" names this protocol.
- [ADR 0005](0005-copilot-reviewer-loop.md) — pathology-detection rule reused here; classifier boundary bounds the LLM calls the protocol may make inside scaleforce.
- [ADR 0007](0007-github-function-routing.md) — cross-repo deliberation is not a slot; it's a protocol invoked within the `discussions` / `issues` / `pr-reviews` slots when scope is multi-repo.
- [ADR 0008](0008-engineering-branch-scaleforce-instrument.md) — establishes Engineering as the synthetic-moderator owner.
- Related reading:
  - LangGraph hierarchical agent teams: https://langchain-ai.github.io/langgraph/tutorials/multi_agent/hierarchical_agent_teams/
  - LLM-as-a-Judge (Zheng et al.): https://arxiv.org/abs/2306.05685
  - AutoGen AgentChat teams: https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html
  - CrewAI processes: https://docs.crewai.com/concepts/processes
