# GitHub Copilot

GitHub Copilot surfaces in this repo under two distinct bot logins, depending on the role it's playing. Treating them as separate identities matters because `scaleforce[bot]` routes events differently for each.

## Identities

| Login | Role | Status in this repo |
|---|---|---|
| `copilot-pull-request-reviewer[bot]` | PR reviewer | **Active.** Requires a Copilot subscription. Assigned as a reviewer on PRs; posts reviews and review comments. |
| `copilot-swe-agent[bot]` | Coding agent (opens PRs) | Documented, not the primary workflow. Would produce a parallel implementation alongside Claude. |

Both are GitHub products, so comments from either get the purple **AI** pill (third-party Apps like `claude[bot]` and `scaleforce[bot]` only get the gray **bot** pill — GitHub UI policy).

## Reviewer role — the active use case

The loop is defined authoritatively by the [`copilot-recursive-review`](https://github.com/thomHayner/ai-skill-builder-library) skill (path: `skills/software-development/copilot-recursive-review/SKILL.md`). [ADR 0005](../../docs/adr/0005-copilot-reviewer-loop.md) captures the decision to anchor `scaleforce[bot]` on it. This file is the agent-facing summary; the skill is the source of truth.

- **Invoke**: assign Copilot as a reviewer on a PR. UI shows the display name **Copilot** in the Reviewers sidebar; the underlying login is `copilot-pull-request-reviewer[bot]`. Programmatic: `POST /repos/{owner}/{repo}/pulls/{number}/requested_reviewers` with `reviewers: ["copilot-pull-request-reviewer[bot]"]` (send the login, not the display name).
- **Event to listen for**: `pull_request_review` with `review.user.login === "copilot-pull-request-reviewer[bot]"`.
- **Copilot cannot approve.** GitHub/Microsoft restricts `copilot-pull-request-reviewer[bot]` to `COMMENTED` reviews — it will never post an `APPROVED` state. Branch-protection approvals still require a human reviewer.
- **Copilot only reviews — it does not fix.** Its output is suggestions. `scaleforce[bot]` (via the skill) triages each thread.

### Loop summary

1. `scaleforce[bot]` requests review from Copilot and records the current HEAD SHA.
2. Waits on a cache-warm cadence (~270s default).
3. On each wake, fetches Copilot reviews matching HEAD. The `pull_request_review` webhook does **not** carry an inline-comment count — compute it with `GET /repos/{o}/{r}/pulls/{n}/reviews/{review_id}/comments` and filter to the current HEAD.
4. Each inline comment is triaged into one of six terminal states:

| Triage | Reply | Side effect | Thread |
|---|---|---|---|
| **FIX** | "Applied in `<sha>`: …" | commit pushed | resolved |
| **REJECT** | "Not changing: …" | none | resolved |
| **DISCUSS** | "Opened <Discussion link>." | new Discussion | resolved |
| **DEFER** | "Filed <Issue link>." | new Issue | resolved |
| **NOISE** | "Skipping — <why>." | none | resolved |
| **HUMAN-PAUSE** | "Pausing — <reason>." | surface to user; loop halts | left open |

5. Re-request review on the new HEAD. Repeat.

### Termination (any one triggers exit)

- Zero unresolved Copilot threads on the current HEAD after a fresh review.
- `HUMAN-PAUSE` raised this round.
- Maintainer says stop / takes over.
- **Same class of comment recurs for 3 rounds with no progress** → surface as `HUMAN-PAUSE` and stop. This is the non-convergence safety valve (replaces the earlier 7-iteration hard cap; pattern detection beats counter-based).

### Other bots on the same PR

Vercel previews, CodeRabbit, Sentry, Renovate, in-house agentic bots — the same six-outcome triage applies. `FIX` takes four shapes for bot threads: fix-on-our-end, agent-to-agent directive (e.g. `@coderabbitai resolve`), trigger-external-action (rerun workflow, redeploy), or acknowledge-and-resolve. The loop is done only when **all** bot threads are terminal, not just Copilot's. Detail lives in the skill's "Other bots on the same PR" section.

## Coding-agent role — documented, not active

- **Invoke**: assign an issue to Copilot, or use "Code with Copilot" in the PR view.
- **Event**: PRs opened by `copilot-swe-agent[bot]`.
- Not the primary workflow here. If enabled, it would run alongside Claude and the maintainer (or `scaleforce[bot]`) would compare outputs.

## Config

- `.github/copilot-instructions.md` applies to both roles when present (create when needed).
