# 0004. Use `docs/` tree instead of GitHub Wiki

- **Status**: accepted
- **Date**: 2026-04-18
- **Deciders**: @thomHayner
- **Tags**: docs, tooling

## Context and Problem Statement

GitHub provides a Wiki feature per repo. It's tempting to use for product docs, but it has structural mismatches with the agent-driven workflow:

- Wikis live in a separate git repo. Not visible in PR diffs.
- Wikis can't be reviewed alongside code changes.
- Agents (Claude Code, Copilot) can't easily edit wiki content as part of a PR.
- Wiki history is not part of the main commit log.

## Decision Drivers

- Docs need to be reviewable in PRs alongside the code that motivates them.
- Agents need to read and write docs as part of normal PR workflow.
- Single source of truth for repo-related knowledge.

## Considered Options

- **GitHub Wiki**: native, free, but disconnected from the PR review surface.
- **`docs/` tree in main repo**: PR-reviewable, agent-editable, version-controlled with the code.
- **External docs site** (Notion, Confluence): even more disconnected.

## Decision Outcome

Chosen: **`docs/` tree in the main repo**, structured as in [`docs/README.md`](../README.md).

Generated/synthesized agent-readable knowledge lives separately in [`llm-wiki/`](../../llm-wiki/) — also in-repo, but explicitly distinct from the human-curated `docs/` layer.

The GitHub Wiki feature is **disabled** for this repo to avoid confusion.

### Consequences

- Good: docs reviewed in PRs, edited by agents, versioned with code.
- Good: clear separation between human-authored (`docs/`) and synthesized (`llm-wiki/`) content.
- Bad: no built-in wiki sidebar / navigation. Mitigation: README index files in each folder.
- Neutral: contributors who expect a Wiki need to be redirected to `docs/`.
