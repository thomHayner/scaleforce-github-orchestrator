# 0005. Copilot-reviewer loop: terminal-state invariant, triage taxonomy, anchor on `copilot-recursive-review` skill

- **Status**: proposed
- **Date**: 2026-04-19
- **Deciders**: @thomHayner
- **Tags**: bots, review, orchestration, copilot

## Context and Problem Statement

`scaleforce[bot]` orchestrates PR review. GitHub Copilot (login `copilot-pull-request-reviewer[bot]`) is the only AI that can be assigned via `requested_reviewers` — empirically verified; GitHub silently rejects every other App. Copilot is also restricted to `COMMENTED` reviews by GitHub/Microsoft, so branch protection approvals are never satisfied by a bot (confirmed in GitHub's [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) — only eligible human reviewers can issue `APPROVED` reviews that count toward branch protection).

We need explicit rules for the loop `scaleforce[bot]` will drive when Copilot reviews a PR:

1. **What signals "clean"** — when does ScaleForce stop re-requesting review?
2. **Who handles Copilot's comments** — triage responsibility and terminal states.
3. **How does the loop avoid running forever** — safety valve on non-convergence.
4. **How do we handle non-Copilot bot comments** on the same PR — Vercel, CodeRabbit, Sentry, etc.

A prior version of this ADR proposed a simple "zero comments = clean / 7-iteration hard cap / PR-author triage" model. That's been superseded by the `copilot-recursive-review` skill (lives in `ai-skill-builder-library/skills/software-development/copilot-recursive-review/`), which encodes a richer model from a working two-round prototype. This ADR captures the decision to anchor `scaleforce[bot]`'s implementation on that skill.

## Decision Drivers

- The skill is already written and has been run successfully end-to-end. Reinventing the loop in ScaleForce would diverge from a working implementation.
- "Zero comments" is too coarse — real reviews produce a mix of legitimate concerns, false positives, scope-creep suggestions, and noise. Each needs a different disposition.
- Round counting is a weak proxy for non-convergence. A PR can loop 2 rounds and be stuck; another can loop 10 productive rounds. Pattern-based termination beats counter-based.
- Copilot is not the only bot on a typical PR. The orchestration model has to absorb Vercel previews, CodeRabbit, Sentry, Renovate, and in-house agentic bots — not just Copilot.
- Probot is stateless-per-event; the loop's state must be reconstructible from GitHub + persisted scratch, not held in process memory.

## Considered Options

- **Option A** (original ADR 0005): zero-comments exit, 7-iteration hard cap, PR-author triage, Copilot-only.
- **Option B** (this ADR): anchor on `copilot-recursive-review` skill — terminal-state invariant with 6-outcome triage, non-convergence pattern detection as the safety valve, skill's "other bots" section for non-Copilot traffic.
- **Option C**: write a new orchestration model from scratch inside ScaleForce. Rejected — duplicates working code and invites drift.

## Decision Outcome

Chosen: **Option B** — `scaleforce[bot]` implements the loop as defined by the `copilot-recursive-review` skill. The skill is the authoritative definition; this ADR summarizes the contract and captures the decision.

### The loop — summary (authoritative detail in the skill)

1. `scaleforce[bot]` requests review from Copilot and records the PR HEAD SHA.
2. Wait on a configurable polling cadence. The skill uses 270s by default, chosen to amortize its own runtime's prompt-cache reuse; the ScaleForce Probot will pick its own cadence based on polling cost, API-rate-limit headroom, and target review latency in its own stack — not coupled to any specific LLM provider's cache behavior.
3. On each wake, fetch Copilot reviews matching the current HEAD. If none, wait again.
4. When a matching review arrives, fetch its review threads for the current HEAD. Each thread — which may contain multiple inline comments — gets one of the six triage outcomes below.
5. For **FIX**, dispatch the change to a code-authoring handler identity (e.g., `claude[bot]`, not `scaleforce[bot]`). The handler decides whether to apply the change, makes the code edits, verifies via the repo's lint/test/build, and authors and pushes the commit to the PR branch under its own identity. For **DISCUSS** / **DEFER**, `scaleforce[bot]` opens the Discussion / Issue. For every triaged thread, `scaleforce[bot]` posts the reply and resolves terminal-state threads.
6. If a FIX commit produced a new HEAD, `scaleforce[bot]` re-requests review on that new HEAD. Repeat.

All orchestration writes in this loop — the review request, per-thread triage replies, thread resolutions, Discussion and Issue creation — run under `scaleforce[bot]`'s installation token. The maintainer PAT is not a fallback. FIX code changes are *not* orchestration writes: they must be attributable to the code-authoring handler identity that made and pushed the commit, per [ADR 0003 § Actor provenance invariant](0003-bot-identity-separation.md#actor-provenance-invariant). scaleforce[bot] is the GitHub transport for a handler-authored change in the FIX path; it is never the code author.

### The terminal-state invariant

Every Copilot review thread must end the loop in one of six states. GitHub's resolvable unit is the thread, so triage and terminal-state enforcement are both defined at the thread level (a thread may contain multiple inline comments; the whole thread takes one outcome). This is the skill's central contract:

| Triage | Reply on thread | Side effect | Thread state |
|---|---|---|---|
| **FIX** | "Applied in `<sha>`: <what changed, where, how verified>" | Commit pushed to PR branch | resolved |
| **REJECT** | "Not changing: <2–4 sentence justification citing rule/file/convention>" | none | resolved |
| **DISCUSS** | "Opened <Discussion link> to track this design question; resolving." | New GitHub Discussion + backlink | resolved |
| **DEFER** | "Legitimate but out of scope; filed <Issue link> to track; resolving." | New GitHub Issue + backlink | resolved |
| **NOISE** | "Skipping — <duplicate / stale / opted-out / auto-generated non-signal>." | none | resolved |
| **HUMAN-PAUSE** | "Pausing here for human review — <reason>" | Surface to user; loop halts | **left open**, called out in final report |

**DISCUSS vs DEFER** is about the *shape* of the follow-up, not its importance: open-ended question → Discussion; concrete scoped work → Issue. If Discussions are disabled on the repo, fold DISCUSS into DEFER with a `question`/`discussion` label.

`HUMAN-PAUSE` is the only escape hatch and it should be rare. If the bot uses it on >~10% of threads, something in the loop isn't working.

### Termination

The loop stops when **any** of these is true:

- Zero unresolved Copilot threads on the current HEAD after a fresh review.
- A `HUMAN-PAUSE` was raised this round.
- The maintainer says stop / takes over.
- **Same class of thread recurs for 3 rounds in a row with no progress** → surface as `HUMAN-PAUSE` and stop. This is the non-convergence safety valve; it replaces the 7-iteration hard cap from the prior ADR version. Pattern-based detection catches the actual pathology (we're not converging) rather than a proxy for it.

### Non-Copilot bot traffic

Other bots comment on the same PR — Vercel previews, CodeRabbit, Renovate, Sentry, in-house agentic bots. Same six-outcome triage taxonomy applies to their threads. `FIX` has four concrete shapes when responding to another bot:

1. Fix on our end (edit our code/config, push, the bot re-runs and re-posts).
2. Agent-to-agent directive (e.g. `@coderabbitai resolve` for bots that accept structured in-thread commands).
3. Trigger an external action (re-run a workflow, redeploy).
4. Acknowledge-and-resolve (bot announced something with no action needed).

The loop is done only when **all** bot threads, not just Copilot's, are in a terminal state. Detail in the skill's "Other bots on the same PR" section.

### Durable state

Probot is stateless across events. The loop's state — round number, HEAD SHA, per-thread triage decisions, commits made — must be reconstructible from a mix of GitHub API queries and persistent scratch (a label on the PR, a sticky comment, or a stored counter keyed by PR number). The skill encodes this via `TodoWrite` for local use; the ScaleForce implementation will choose a GitHub-durable equivalent when it's built.

Critically: "zero unresolved threads on this HEAD" is not inferable from the `pull_request_review` webhook payload — that event carries neither inline-comment counts nor thread resolution state. `scaleforce[bot]` must compute it by fetching the review's inline comments (`GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments`) plus the PR's review threads via the GraphQL `pullRequest.reviewThreads` field (for `isResolved`), then filtering to threads tied to the current HEAD SHA.

### Classifier boundary

*Added 2026-04-22 alongside [ADR 0008](0008-engineering-branch-scaleforce-instrument.md).*

Triaging a Copilot thread into FIX / REJECT / DISCUSS / DEFER / NOISE / HUMAN-PAUSE requires reading comprehension on free text — the thread is prose, not a labeled payload. This is the **one place** inside `scaleforce[bot]`'s loop where a narrow templated LLM call is permitted. [ADR 0008](0008-engineering-branch-scaleforce-instrument.md) establishes that scaleforce is Engineering's instrument and that reasoning belongs to Engineering; this section names the exception.

**What is permitted inside scaleforce:**

- **Structured classification of free text into a fixed taxonomy.** Triage (one of six outcomes), scope detection ("does this thread mention a file outside this repo?"), intent extraction from `@scaleforce` directives, thread-class identification for non-convergence detection. Inputs are bounded (one thread at a time; a configurable prose-length cap), outputs are structured (an enum + a short rationale), and the model has no authority to take actions — it returns a label, scaleforce decides what to do with it.
- **Summarization of a thread to assemble a context packet for a handler.** Compressing a Copilot thread (possibly with its inline-comment siblings) into a single paragraph that a handler like `claude[bot]` receives alongside the original payload. Summarization is a classification-adjacent task: it does not invent content, does not decide, and its output is auditable against the source.
- **Non-convergence pattern detection.** Recognizing "the thread Copilot just raised is the same *class* as the one we FIXed two rounds ago" is a classification over two pieces of text. Permitted inside scaleforce; the decision to surface `HUMAN-PAUSE` flows from the classification plus the round count (which is a deterministic state field).

**What is not permitted inside scaleforce — even if an LLM call would answer:**

- Deciding *what* a FIX should be. scaleforce classifies a thread as FIX-worthy; the handler (claude[bot], a repo-wiki-agent, etc.) decides and applies the change.
- Judging whether a REJECT is correct for this codebase. scaleforce can classify "this comment looks like a taste disagreement" (triage), but "we should reject because our convention says X" requires codebase knowledge and belongs to Engineering or the repo-wiki-agent.
- Synthesizing across multiple threads or across repos. Fan-out yes; merge no. See [ADR 0009](0009-ordered-cross-repo-deliberation.md).
- Choosing between legitimate conflicting positions. That is synthetic moderation and it is Engineering's.
- Answering novel or ambiguous classifications where the classifier's confidence is low. In that case scaleforce escalates to Engineering (or the relevant repo-wiki-agent) rather than guessing — the output of the templated call includes a confidence field, and below a configured threshold the call returns `NEEDS_ENGINEERING` instead of a six-outcome label.

**Operational constraints on permitted calls:**

- **Templated**, with a fixed prompt + schema per classification task. No free-form prompts constructed at runtime from unbounded input.
- **Bounded**, with explicit input-size caps. A thread longer than the cap is truncated around the latest comment with a note, or escalated if truncation would lose necessary context.
- **Cacheable** by (prompt version, input hash). The same thread classified twice returns the same label unless the prompt version rolls.
- **Auditable.** Every templated call logs an [ADR 0006](0006-llm-observability.md) event with the template name, input hash, output label, confidence, and classifier version.
- **Deterministic fallback.** Every template has a deterministic default for total failure (network error, model returns nothing): typically escalate to Engineering or surface `HUMAN-PAUSE`, never silently pick a label.

**Tripwire.** A classifier template that starts returning free-form text, taking actions on its own, or producing outputs outside its declared schema is a drift signal and should be rolled back.

The charter's shorthand — "reading comprehension on free text → narrow templated LLM call inside scaleforce; codebase reasoning → Engineering" — is the principle. This section is the operational detail.

### Consequences

- Good: aligns with working implementation rather than reinventing it. Skill and ADR stay in sync by construction.
- Good: six-outcome triage gives Discussions and Issues a consistent vocabulary across phases (see [ADR 0007](0007-github-function-routing.md) on routing).
- Good: pattern-based non-convergence detection is more sensitive than a round cap — catches stuck loops earlier without terminating productive ones.
- Good: other-bots handling collapses into the same taxonomy, so ScaleForce doesn't need a separate code path per bot.
- Bad: authoritative loop definition lives in a different repo (`ai-skill-builder-library`). If the skill moves or is renamed, this ADR needs an update. Mitigation: reference by skill name, not path, and keep the name stable.
- Neutral: human approval remains the only branch-protection merge gate. The loop produces advisory signal; it does not unblock merge.

## More Information

- [`copilot-recursive-review`](https://github.com/thomHayner/ai-skill-builder-library) skill — authoritative loop definition (path at time of writing: `skills/software-development/copilot-recursive-review/SKILL.md`).
- [ADR 0003](0003-bot-identity-separation.md) — identity separation, where the bot logins are enumerated.
- [ADR 0007](0007-github-function-routing.md) — the routing schema that decides *when* to invoke this loop.
- [`llm-wiki/agents/copilot.md`](../../llm-wiki/agents/copilot.md) — agent-facing summary.
- GitHub REST: `POST /repos/{owner}/{repo}/pulls/{number}/requested_reviewers` with `reviewers: ["copilot-pull-request-reviewer[bot]"]`. Webhook: `pull_request_review` → dispatch on `review.user.login`.
