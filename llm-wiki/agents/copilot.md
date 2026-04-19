# GitHub Copilot

GitHub Copilot surfaces in this repo under two distinct bot logins, depending on the role it's playing. Treating them as separate identities matters because `scaleforce[bot]` routes events differently for each.

## Identities

| Login | Role | Status in this repo |
|---|---|---|
| `copilot-pull-request-reviewer[bot]` | PR reviewer | **Active.** Requires a Copilot subscription. Assigned as a reviewer on PRs; posts reviews and review comments. |
| `copilot-swe-agent[bot]` | Coding agent (opens PRs) | Documented, not the primary workflow. Would produce a parallel implementation alongside Claude. |

Both are GitHub products, so comments from either get the purple **AI** pill (third-party Apps like `claude[bot]` and `scaleforce[bot]` only get the gray **bot** pill — GitHub UI policy).

## Reviewer role — the active use case

- **Invoke**: assign Copilot as a reviewer on a PR (via the Reviewers sidebar, or programmatically via `POST /repos/{owner}/{repo}/pulls/{number}/requested_reviewers` with `reviewers: ["Copilot"]`).
- **Event to listen for**: `pull_request_review` with `review.user.login === "copilot-pull-request-reviewer[bot]"`.
- **Copilot cannot approve.** GitHub/Microsoft restricts `copilot-pull-request-reviewer[bot]` to `COMMENTED` reviews — it will never post an `APPROVED` state. So the loop-exit condition must be "zero comments," not "approved."
- **Copilot only reviews — it does not fix.** Its output is suggestions. The PR author is responsible for triaging those suggestions and deciding how to proceed (accept, modify, or reject with rationale).
- **Re-request loop** (driven by `scaleforce[bot]`):
  1. Request review from Copilot.
  2. When Copilot's review arrives:
     - **Zero review comments** → **exit** (this is "clean").
     - **One or more review comments** → route to the **PR author** (loops 1–6) or **escalate to the maintainer** (loop 7) to triage, fix, push, then re-request review.
  3. Recurse until a review comes back with zero comments or the 7-iteration cap fires.
- **Max 7 iterations.** `scaleforce[bot]` tracks iteration count per PR. On the 7th review-with-comments, the routing flips from PR author to maintainer — author/Copilot aren't converging and a human needs to break the tie.
- **Routing by PR author** (who `scaleforce[bot]` pings to handle the comments):
  | PR author | Routes to |
  |---|---|
  | `claude[bot]` | `@claude` in the PR thread |
  | `thomHayner` (maintainer) | the maintainer |
  | future code agents (e.g. Codex) | that agent's handle |

  The PR author agent owns triage: weigh Copilot's suggestions, apply fixes where warranted, reply inline with rationale where rejecting, then push and ask `scaleforce[bot]` to re-request review.

## Coding-agent role — documented, not active

- **Invoke**: assign an issue to Copilot, or use "Code with Copilot" in the PR view.
- **Event**: PRs opened by `copilot-swe-agent[bot]`.
- Not the primary workflow here. If enabled, it would run alongside Claude and the maintainer (or `scaleforce[bot]`) would compare outputs.

## Config

- `.github/copilot-instructions.md` applies to both roles when present (create when needed).
