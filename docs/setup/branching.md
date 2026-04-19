# Branching model

> Decided in [ADR 0002](../adr/0002-use-feature-dev-main-branch-model.md).

## Branches

| Branch | Purpose | Push policy |
|---|---|---|
| `main` | Release-only. Always deployable. | Protected. Required reviews. No direct pushes. |
| `dev` | Working integration branch. | Direct commits OK when iterating. |
| `feature/*` | Optional isolation for larger work or parallel agent PRs. | Free. |

## Flows

### Quick iteration with the maintainer
```
commit directly to dev → ... → release PR dev → main
```

### Larger feature, or parallel agent work
```
branch from dev → feature/foo → PR feature/foo → dev → release PR dev → main
```

### Hotfix
Branch from `main`, PR back into `main`, then cherry-pick or merge into `dev`.

## Release

When `dev` is ready to ship:

1. Open PR `dev → main`.
2. Squash or merge (preserve commit history; squash if `dev` got noisy).
3. Tag `main` with the release version.
4. `dev` continues from there.

## Branch protection (configure on GitHub)

`main`:
- Require PR before merging
- Require at least 1 approving review
- Require status checks to pass (CI)
- Restrict who can push (no one — only PR merges)

`dev`:
- No restrictions, but warn on force-push
