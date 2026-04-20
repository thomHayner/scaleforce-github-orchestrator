# Bot identity setup

> Decided in [ADR 0003](../adr/0003-bot-identity-separation.md).

## The cast

| Identity | Role | How to install/configure |
|---|---|---|
| `scaleforce[bot]` | Orchestration: triage, routing, PR mediation | This repo's Probot. Configure at https://github.com/settings/apps/scaleforce |
| `claude[bot]` | Substantive AI: code, deep PR review | Install [Claude GitHub App](https://github.com/apps/claude) |
| `copilot-pull-request-reviewer[bot]` | GitHub Copilot PR reviewer (active). `scaleforce[bot]` re-requests reviews from this identity until clean. | Assign Copilot as a reviewer on a PR; requires a Copilot subscription. |
| `copilot-swe-agent[bot]` | Copilot coding agent (documented, not the primary workflow) | Enable Copilot coding agent in repo settings |

## The maintainer's git config — never let agents change

```sh
git config user.name  "Thomas Hayner"
git config user.email "your-email@example.com"
```

All commits — including those produced by Claude Code — are authored by this identity. AI contribution is recorded via:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

This keeps "we worked together" visible in the contribution graph and PR history.

## Local Claude Code: identity discipline

When running `claude` locally, before any GitHub-side write (comment, issue, PR), Claude must verify identity with `gh auth status`. If authenticated as the maintainer, do not post under that identity — either:

1. Route through the Claude GitHub App by `@claude`-mentioning in the relevant thread, or
2. Set `GH_TOKEN` to a token belonging to a bot identity for that shell session, or
3. Leave a draft in `docs/drafts/` for the maintainer to post manually.

## Why third-party Apps don't get the purple "AI" pill

GitHub reserves the **AI** pill (visible next to Copilot's comments) for its own AI products. Third-party GitHub Apps — including `claude[bot]` and `scaleforce[bot]` — get the gray **bot** pill, same as Vercel, Dependabot, Netlify. This is a GitHub UI policy, not something we can override.
