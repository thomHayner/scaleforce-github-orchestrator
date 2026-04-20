# Architecture Decision Records

Decisions that shape the system, captured in [MADR](https://adr.github.io/madr/) format.

## Conventions

- One file per decision: `NNNN-short-slug.md`, sequentially numbered.
- Status flows: `proposed` → `accepted` → (optionally) `deprecated` / `superseded by NNNN`.
- Never delete an ADR. Supersede it with a new one and update the old one's status.
- Architecture-affecting PRs must add or update an ADR in the same PR.

## Template

See [`template.md`](template.md) — copy it for new ADRs.

## Index

- [0001](0001-record-architecture-decisions.md) — Record architecture decisions
- [0002](0002-use-feature-dev-main-branch-model.md) — Use `feature → dev → main` branch model
- [0003](0003-bot-identity-separation.md) — Separate bot identities for orchestration vs. AI work
- [0004](0004-docs-tree-over-github-wiki.md) — Use `docs/` tree instead of GitHub Wiki
- [0005](0005-copilot-reviewer-loop.md) — Copilot-reviewer loop: terminal-state invariant, triage taxonomy, anchor on `copilot-recursive-review` skill
- [0007](0007-github-function-routing.md) — GitHub function routing: cascading defaults with per-function overrides
