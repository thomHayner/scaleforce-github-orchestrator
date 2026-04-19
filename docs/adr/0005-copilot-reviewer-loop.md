# 0005. Copilot-reviewer loop: zero-comments exit, PR-author-owned triage

- **Status**: proposed
- **Date**: 2026-04-19
- **Deciders**: @thomHayner
- **Tags**: bots, review, orchestration, copilot

## Context and Problem Statement

`scaleforce[bot]` orchestrates PR review in this repo. GitHub Copilot, assigned as a reviewer on PRs, posts reviews as `copilot-pull-request-reviewer[bot]`. Two questions need settled answers before probot can implement the re-request loop:

1. **What signals "clean"** — when does ScaleForce stop re-requesting review from Copilot?
2. **Who handles Copilot's review comments** — when Copilot leaves suggestions, whose job is it to triage and apply fixes?

Both are orchestration rules probot will enforce automatically, so they need to be explicit and stable.

## Decision Drivers

- Copilot's reviewer identity (`copilot-pull-request-reviewer[bot]`) is restricted by GitHub/Microsoft to `COMMENTED` reviews — it cannot post an `APPROVED` state. Any exit condition that waits for approval would loop forever.
- Copilot reviews; it does not write fixes. Someone else has to triage the suggestions and decide how to respond.
- This repo may gain additional code agents (Codex, others) over time. The routing rule should extend without a rewrite.
- Each identity in the agency should own its own work — the PR author is the actor best positioned to judge Copilot's suggestions against the change they authored.

## Considered Options

- **Option A: exit on `APPROVED`.** Standard GitHub review semantics. Rejected because Copilot can't ever reach this state.
- **Option B: exit on `COMMENTED` with zero review comments.** Treats "nothing to say" as approval-equivalent for the purposes of the loop.
- **Option C: exit on a maintainer override only.** Always surface Copilot's review to the maintainer; never auto-exit.

For fix-routing:
- **Option X: always route to `claude[bot]`.** Simple; works while Claude is the only non-human code agent.
- **Option Y: always route to the maintainer.** Low automation.
- **Option Z: route based on PR author.** Claude's PRs get `@claude`, the maintainer's PRs get the maintainer, future agents get themselves.

## Decision Outcome

Chosen:

- **Exit condition: Option B** — Copilot's review comes back with zero review comments (i.e. `COMMENTED` state, empty comment list). This is "clean."
- **Fix routing: Option Z** — `scaleforce[bot]` pings the PR author when Copilot leaves comments. The PR author owns triage.

### The loop, explicitly

1. `scaleforce[bot]` requests review from Copilot on a PR.
2. On `pull_request_review` with `review.user.login === "copilot-pull-request-reviewer[bot]"`:
   - **Zero review comments** → exit. PR is clean as far as Copilot is concerned.
   - **One or more review comments** → ping the PR author to triage (loops 1–6), or escalate to the maintainer (loop 7+).
3. PR author (or maintainer on escalation) triages Copilot's suggestions: accept and fix, modify, or reject inline with rationale.
4. PR author pushes fixes and signals `scaleforce[bot]` to re-request review from Copilot.
5. Recurse until exit (zero comments) or escalation (loop 7).

### Max iterations

The loop caps at **7 iterations**. `scaleforce[bot]` tracks iteration count per PR (e.g. as a label, a sticky comment, or a stored counter). On the 7th review-with-comments, the routing flips from PR author to maintainer — this is the signal that author/Copilot are not converging and a human needs to break the tie (adjust scope, override a Copilot suggestion, or close the PR).

Rationale for seven: high enough that normal back-and-forth never trips it (most PRs converge in 1–2 loops), low enough that a runaway loop gets caught before it wastes real time or API quota.

### Routing table

| PR author | `scaleforce[bot]` pings |
|---|---|
| `claude[bot]` | `@claude` in the PR thread |
| `thomHayner` (maintainer) | the maintainer directly |
| future code agents (e.g. Codex) | that agent's handle |

### Consequences

- Good: loop terminates deterministically — no waiting for a state Copilot cannot produce.
- Good: routing extends to new code agents by adding a row, not changing logic.
- Good: the 7-iteration cap bounds worst-case cost and guarantees a human gets pulled in on pathological loops.
- Good: preserves the "each identity owns its work" principle from [ADR 0003](0003-bot-identity-separation.md).
- Bad: zero-comments-as-clean is a convention, not a formal approval. A human reviewer is still required before merge to `main` per the branch model ([ADR 0002](0002-use-feature-dev-main-branch-model.md)).
- Neutral: if Copilot ever gains the ability to approve (or GitHub relaxes the restriction), the exit condition should be revisited — at that point `APPROVED` becomes the stronger signal.

## More Information

- [`llm-wiki/agents/copilot.md`](../../llm-wiki/agents/copilot.md) — agent-facing description of the loop.
- [ADR 0003](0003-bot-identity-separation.md) — identity separation rationale.
- GitHub REST: `POST /repos/{owner}/{repo}/pulls/{number}/requested_reviewers` with `reviewers: ["Copilot"]`.
- Webhook: `pull_request_review` — dispatch on `review.user.login`.
