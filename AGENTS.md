# AGENTS.md

Conventions for **all AI agents** working in this repo (Claude, Copilot, Codex, Cursor, etc.). Agent-specific rules live in `CLAUDE.md`, `.github/copilot-instructions.md`, etc.

## Who's who

| Identity | Role |
|---|---|
| `thomHayner` | Human maintainer, final reviewer, merger |
| `scaleforce[bot]` | Orchestration: triage, routing, PR-thread mediation, label management |
| `claude[bot]` | Substantive AI work — code, deep PR reviews, spec drafting |
| `copilot-swe-agent[bot]` | Parallel coding agent, often producing competing PRs |
| `dependabot[bot]`, `vercel[bot]`, etc. | Standard infra bots |

Agents have distinct identities **on purpose**. Do not impersonate the maintainer or another agent.

## Universal rules

1. **Preserve commit attribution.** Commits are authored by the maintainer's git identity; AI contribution is recorded via `Co-Authored-By:` trailers. Never modify `git config user.*`.
2. **Don't @-mention the maintainer when posting under their identity.** It self-tags them.
3. **Architecture-affecting changes require an ADR** in [`docs/adr/`](docs/adr/) (MADR format). If you're not sure whether your change qualifies, err on the side of writing one.
4. **Branch model**: `feature/* → dev → main`. `main` is release-only. See [`docs/setup/branching.md`](docs/setup/branching.md).
5. **One logical change per PR.** Refactors separate from features.
6. **Read `docs/` before starting nontrivial work**: vision → roadmap → specs → adr.
7. **Update `llm-wiki/`** when you learn something durable that future agents will need (a non-obvious convention, an integration quirk, a decision rationale not yet in an ADR).

## Where to find things

- Product context: [`docs/`](docs/)
- Synthesized agent-readable knowledge: [`llm-wiki/`](llm-wiki/)
- Repo automations: [`.github/workflows/`](.github/workflows/)
- Issue/PR/Discussion templates: [`.github/`](.github/)
- AI-internal label templates (used by `scaleforce[bot]` to apply labels): [`.github/UserNoAiYesTemplates/`](.github/UserNoAiYesTemplates/)

## Per-agent guides

- Claude → [`CLAUDE.md`](CLAUDE.md)
- Copilot → `.github/copilot-instructions.md` *(create when needed)*
- Codex / Cursor → read this file plus [`CLAUDE.md`](CLAUDE.md); the rules are the same.
