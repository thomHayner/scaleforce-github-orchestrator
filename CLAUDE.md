# CLAUDE.md

Conventions for Claude Code (and Claude when invoked via the GitHub App) working in this repo.

## Identity & attribution

This repo runs an "AI agency" pattern with multiple distinct identities. **Knowing who you are posting as is load-bearing.**

- **You (Claude)** post on GitHub as `claude[bot]` when invoked via the Claude GitHub App / Claude Code Action. Locally, you may shell to `gh` under whatever account is authenticated — verify with `gh auth status` before posting anything.
- **The maintainer** is `thomHayner`. They are a human; their comments and reviews are theirs alone.
- **The orchestration bot** (this repo's Probot) is `scaleforce[bot]`. It handles triage, routing, and PR-thread mediation.
- **GitHub Copilot** surfaces under two bot logins depending on role:
  - `copilot-pull-request-reviewer[bot]` — Copilot reviewing a PR. This is the active use case; `scaleforce[bot]` requests and re-requests reviews from this identity until it returns clean.
  - `copilot-swe-agent[bot]` — Copilot's coding agent when it authors a PR. Available but not the primary workflow here.
- **Other agents**: `dependabot[bot]`, `vercel[bot]`, etc.

### Comment authoring rules

1. **Never @-mention the maintainer when posting under their account.** If `gh auth status` shows you're authenticated as `thomHayner` (or anyone other than a bot), do not write `@thomHayner` in the comment body — it would self-tag them.
2. **When posting as a bot, normal @-mentions are fine and encouraged** when human attention is needed.
3. **Never modify `git config user.name` or `git config user.email`.** Commits must be authored by the human maintainer's email so they appear on the maintainer's contribution graph. Use `Co-Authored-By: Claude <noreply@anthropic.com>` trailers to mark AI contribution. This is the convention that keeps "we worked together" visible.
4. **Do not post substantive replies on behalf of the maintainer.** If a thread needs an AI reply, route through the Claude GitHub App so the comment is attributed to `claude[bot]`. If that's not available, leave a draft in `docs/drafts/` for the maintainer to review and post manually.

## Branch model

- `main` is protected, release-only. Never push directly.
- `dev` is the working branch. Direct commits are allowed when iterating with the maintainer.
- `feature/*` branches are optional — used when work is large enough to deserve isolation, or when multiple agents are working in parallel.
- Flow: `feature/* → PR → dev` (optional), `dev → PR → main` on release.
- See [`docs/setup/branching.md`](docs/setup/branching.md) for detail.

## ADRs

Architecture-affecting changes require an ADR in [`docs/adr/`](docs/adr/) using [MADR](https://adr.github.io/madr/) format. If your PR meaningfully changes structure, dependencies, deployment, identity boundaries, or external integrations, write or update the relevant ADR in the same PR.

## Where to find context

Read in this order before starting nontrivial work:

1. [`docs/vision/`](docs/vision/) — what we're building and why.
2. [`docs/roadmap/`](docs/roadmap/) — what's next.
3. [`docs/specs/`](docs/specs/) — current in-flight specs.
4. [`docs/adr/`](docs/adr/) — accepted decisions; do not contradict them without a new ADR.
5. [`llm-wiki/`](llm-wiki/) — synthesized, agent-friendly knowledge derived from the above plus PR-thread history.
6. [`AGENTS.md`](AGENTS.md) — conventions shared by all agents (you, Copilot, Codex).

## PR conventions

- Title under 70 chars, imperative ("Add X", "Fix Y").
- Body uses [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).
- Link the relevant spec or ADR.
- For features: include a brief test plan even if tests are added.
- One logical change per PR. Refactors and feature work go in separate PRs unless impossible.

## Things to avoid

- Don't introduce new dependencies without a one-line justification in the PR body.
- Don't write speculative "future-proofing" abstractions. Three similar lines is better than a premature interface.
- Don't add comments that restate the code. Comments explain *why*, not *what*.
- Don't create documentation files unless asked or unless an ADR/spec is genuinely warranted.
- Don't bypass git hooks (`--no-verify`) without explicit maintainer approval.
