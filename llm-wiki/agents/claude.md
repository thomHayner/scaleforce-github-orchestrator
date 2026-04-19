# claude[bot]

The substantive AI worker.

## Identity

- GitHub App: official [Claude GitHub App](https://github.com/apps/claude)
- Bot username: `claude[bot]`
- Owner: Anthropic (App), installed on `ScaleForceAgency` and personal repos

## How to invoke

- **In any issue/PR/comment**: write `@claude` plus an instruction. The Claude Code Action workflow (`.github/workflows/claude.yml`) picks up the mention and runs Claude Code with full repo context.
- **Locally**: run `claude` CLI. Local Claude must follow [`../../CLAUDE.md`](../../CLAUDE.md) identity rules — never post on GitHub under the maintainer's identity.

## What it does

- Writes code, opens PRs
- Performs deep PR review
- Drafts specs, ADRs, PRDs from rough requirements
- Answers questions in threads (when `@claude`-mentioned)

## What it does NOT do

- Does not handle triage or routing — that's `scaleforce[bot]`'s job
- Does not modify `git config user.*`
- Does not @-mention the maintainer when posting under the maintainer's identity (local CLI case)

## Commit attribution

Commits authored by maintainer's git identity, with `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.
