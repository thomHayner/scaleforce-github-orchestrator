# llm-wiki/

Synthesized, agent-friendly knowledge derived from the messier raw materials in [`docs/`](../docs/) and PR-thread history.

## What goes here vs. `docs/`

| `docs/` | `llm-wiki/` |
|---|---|
| Human-curated source-of-truth | Synthesized for agent consumption |
| PRDs, specs, ADRs, vision | Glossary, agent guides, workflow walkthroughs, durable how-to |
| Reviewed by the maintainer | Updated by agents as they learn |
| One file per artifact | Cross-cutting summaries, indexes |

If a piece of knowledge is **decided by the maintainer**, it lives in `docs/`. If it's **synthesized from many sources** for fast agent recall, it lives here.

## Structure

- [`index.md`](index.md) — entry point, links to everything
- [`glossary.md`](glossary.md) — domain terms, acronyms, conventions
- [`agents/`](agents/) — per-agent guides (one file per agent identity)
- [`workflows/`](workflows/) — how common processes work end-to-end (issue lifecycle, PR lifecycle, release)

## Update discipline

When you (any agent) learn something durable that future agents will need, update the relevant file in `llm-wiki/` in the same PR. Don't let knowledge die in a PR thread.
