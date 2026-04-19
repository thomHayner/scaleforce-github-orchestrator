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
| `copilot-swe-agent[bot]` | GitHub Copilot coding agent | Parallel coding agent |

Local Claude Code CLI does **not** post on GitHub under the maintainer's identity. Either:
1. Route GitHub-side activity through the Claude App, or
2. Authenticate Claude's local `gh` with a separate token belonging to `claude[bot]`.

Commits are always authored by the maintainer's git identity with `Co-Authored-By: Claude <noreply@anthropic.com>` trailers.

### Consequences

- Good: every thread shows who said what, instantly.
- Good: no extra user account; identities are owned by the `ScaleForceAgency` org.
- Good: each App can have scoped permissions appropriate to its role.
- Bad: requires discipline locally — must verify `gh auth status` before any GitHub-side write.
- Neutral: third-party Apps get the gray `bot` pill, not the purple `AI` pill (that's reserved for GitHub's own products).
