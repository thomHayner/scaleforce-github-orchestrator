# 0003. Separate bot identities for orchestration vs. AI work

- **Status**: accepted
- **Date**: 2026-04-18
- **Deciders**: @thomHayner
- **Tags**: identity, bots, governance

## Context and Problem Statement

When multiple AI tools act in a repo (Claude, Copilot, an orchestration bot, Dependabot, etc.), it must be **visually unambiguous** in any thread who said what. Conflating identities — especially having Claude post comments as the human maintainer — destroys the audit trail and makes review painful.

A particular failure mode observed: running Claude Code locally, where `gh` is authenticated as the maintainer, causes Claude to post comments and open issues *as the maintainer*. This was wrong.

## Decision Drivers

- Each actor in a thread must have a distinct visual identity.
- Commit attribution should still credit the maintainer (with `Co-Authored-By:` for AI contribution).
- The maintainer wants @-mentions from AI agents to feel like real pings, not self-tags.

## Considered Options

- **Single bot for everything** (e.g., one Probot doing both orchestration and AI responses): conflates roles.
- **Bot account (User type)**: a separate GitHub user account for AI activity. Works, but adds a user to manage and can't be owned by an org.
- **Multiple GitHub Apps with distinct bot identities**: each gets `[bot]` pill automatically, owned by org, no extra user.

## Decision Outcome

Chosen: **Multiple GitHub Apps**, each with its own role and identity:

| Identity | App | Role |
|---|---|---|
| `scaleforce[bot]` | This repo's Probot | Orchestration: triage, routing, PR-thread mediation |
| `claude[bot]` | Anthropic's Claude GitHub App | Substantive AI work: code, deep PR review, spec drafting |
| `copilot-pull-request-reviewer[bot]` | GitHub Copilot (reviewer role) | PR reviewer; `scaleforce[bot]` requests and re-requests reviews until clean. Active use case. |
| `copilot-swe-agent[bot]` | GitHub Copilot (coding-agent role) | Parallel coding agent. Documented but not the primary workflow. |

Local Claude Code CLI does **not** post on GitHub under the maintainer's identity. Either:
1. Route GitHub-side activity through the Claude App, or
2. Authenticate Claude's local `gh` with a separate token belonging to `claude[bot]`.

Commits are always authored by the maintainer's git identity with `Co-Authored-By: Claude <noreply@anthropic.com>` trailers.

### Actor provenance invariant

The identity table above is not descriptive — it is an **operational invariant**. Every GitHub write that is part of orchestration work must be attributable, at the GitHub level, to the identity that owns that work:

- **Orchestration actions run under `scaleforce[bot]`.** Review requests and re-requests, triage replies to review comments, thread resolutions (`resolveReviewThread`), Discussion creation, Issue creation/updates from triage, labels, sticky comments for loop state — all of these are `scaleforce[bot]`'s work and must post under its installation token, never a maintainer PAT or any other identity.
- **AI code work runs under `claude[bot]`** (or whichever code-agent identity authored it), not under the maintainer. See the rule above about local `gh` auth.
- **Reviewer output runs under the reviewer's identity.** Copilot's inline comments are `copilot-pull-request-reviewer[bot]`'s; pre-PR review output from a skill is attributed to the corresponding handler identity, not to whoever ran the skill.
- **The maintainer's identity is reserved for explicit human decisions** — branch-protection approvals, merges, overrides, and judgment calls that deliberately override automation. If a human token is posting routine orchestration output, that is a governance bug to fix, not an acceptable shortcut.

**Why it matters.** The whole identity table is worthless if anyone can post under the wrong name. A `thomHayner`-authored triage reply is indistinguishable, in a thread, from a real maintainer decision — it silently steals the audit trail that [ADR 0003](0003-bot-identity-separation.md) exists to protect.

**Interim exception.** While `scaleforce[bot]` is not yet deployed, orchestration actions taken manually by the maintainer (e.g., running `gh` auth'd as the maintainer to post triage replies) are a known temporary gap. These actions should be migrated to `scaleforce[bot]` the moment the App is live. They are not a precedent.

**How to enforce.** Before merging code that performs a GitHub write, ask: *which identity does this post under at runtime?* If the answer is "whoever ran the script," the code is wrong. `scaleforce[bot]` writes use the Probot / Octokit client built from its installation token; Claude writes use the Claude App's token; the maintainer PAT is not a fallback.

### Consequences

- Good: every thread shows who said what, instantly.
- Good: no extra user account; identities are owned by the `ScaleForceAgency` org.
- Good: each App can have scoped permissions appropriate to its role.
- Bad: requires discipline locally — must verify `gh auth status` before any GitHub-side write.
- Neutral: third-party Apps get the gray `bot` pill, not the purple `AI` pill (that's reserved for GitHub's own products).
