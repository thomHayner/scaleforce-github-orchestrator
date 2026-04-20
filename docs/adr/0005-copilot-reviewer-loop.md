# 0005. Copilot-reviewer loop: terminal-state invariant, triage taxonomy, anchor on `copilot-recursive-review` skill

- **Status**: proposed
- **Date**: 2026-04-19
- **Deciders**: @thomHayner
- **Tags**: bots, review, orchestration, copilot

## Context and Problem Statement

`scaleforce[bot]` orchestrates PR review. GitHub Copilot (login `copilot-pull-request-reviewer[bot]`) is the only AI that can be assigned via `requested_reviewers` — empirically verified; GitHub silently rejects every other App. Copilot is also restricted to `COMMENTED` reviews by GitHub/Microsoft, so branch protection approvals are never satisfied by a bot (confirmed in GitHub's [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) — only eligible human reviewers can issue counting `APPROVED` reviews).

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
2. Wait on a cadence picked to keep the Anthropic prompt cache warm (270s default, per the skill's rationale).
3. On each wake, fetch Copilot reviews matching the current HEAD. If none, wait again.
4. When a matching review arrives, fetch its inline comments. Each comment gets one of the six triage outcomes below.
5. Apply FIXes (verified via the repo's lint/test/build), open Discussions / Issues for DISCUSS / DEFER, reply on every thread, resolve terminal-state threads, commit, push.
6. Re-request review on the new HEAD. Repeat.

### The terminal-state invariant

Every Copilot thread must end the loop in one of six states. This is the skill's central contract:

| Triage | Reply on thread | Side effect | Thread state |
|---|---|---|---|
| **FIX** | "Applied in `<sha>`: <what changed, where, how verified>" | Commit pushed to PR branch | resolved |
| **REJECT** | "Not changing: <2–4 sentence justification citing rule/file/convention>" | none | resolved |
| **DISCUSS** | "Opened <Discussion link> to track this design question; resolving." | New GitHub Discussion + backlink | resolved |
| **DEFER** | "Legitimate but out of scope; filed <Issue link> to track; resolving." | New GitHub Issue + backlink | resolved |
| **NOISE** | "Skipping — <duplicate / stale / opted-out / auto-generated non-signal>." | none | resolved |
| **HUMAN-PAUSE** | "Pausing here for human review — <reason>" | Surface to user; loop halts | **left open**, called out in final report |

**DISCUSS vs DEFER** is about the *shape* of the follow-up, not its importance: open-ended question → Discussion; concrete scoped work → Issue. If Discussions are disabled on the repo, fold DISCUSS into DEFER with a `question`/`discussion` label.

`HUMAN-PAUSE` is the only escape hatch and it should be rare. If the bot uses it for >~10% of comments, something in the loop isn't working.

### Termination

The loop stops when **any** of these is true:

- Zero unresolved Copilot threads on the current HEAD after a fresh review.
- A `HUMAN-PAUSE` was raised this round.
- The maintainer says stop / takes over.
- **Same class of comment recurs for 3 rounds in a row with no progress** → surface as `HUMAN-PAUSE` and stop. This is the non-convergence safety valve; it replaces the 7-iteration hard cap from the prior ADR version. Pattern-based detection catches the actual pathology (we're not converging) rather than a proxy for it.

### Non-Copilot bot traffic

Other bots comment on the same PR — Vercel previews, CodeRabbit, Renovate, Sentry, in-house agentic bots. Same six-outcome triage taxonomy applies to their threads. `FIX` has four concrete shapes when responding to another bot:

1. Fix on our end (edit our code/config, push, the bot re-runs and re-posts).
2. Agent-to-agent directive (e.g. `@coderabbitai resolve` for bots that accept structured in-thread commands).
3. Trigger an external action (re-run a workflow, redeploy).
4. Acknowledge-and-resolve (bot announced something with no action needed).

The loop is done only when **all** bot threads, not just Copilot's, are in a terminal state. Detail in the skill's "Other bots on the same PR" section.

### Durable state

Probot is stateless across events. The loop's state — round number, HEAD SHA, per-comment triage decisions, commits made — must be reconstructible from a mix of GitHub API queries and persistent scratch (a label on the PR, a sticky comment, or a stored counter keyed by PR number). The skill encodes this via `TodoWrite` for local use; the ScaleForce implementation will choose a GitHub-durable equivalent when it's built.

Critically: "zero comments on this HEAD" is not inferable from the `pull_request_review` webhook payload — that event doesn't carry an inline-comment count. `scaleforce[bot]` must compute it by fetching the review's inline comments — `GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments` — counting the returned items, and filtering to threads tied to the current HEAD SHA.

### Consequences

- Good: aligns with working implementation rather than reinventing it. Skill and ADR stay in sync by construction.
- Good: six-outcome triage gives Discussions and Issues a consistent vocabulary across phases (see forthcoming ADR 0007 on routing).
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
