# PR lifecycle

> Currently aspirational — `scaleforce[bot]` does not yet handle PR events. This file documents the intended workflow and updates as features land.

## Target flow

```
PR opened (against dev or main)
  └─→ scaleforce[bot] posts review checklist + requests review from claude[bot]
       └─→ claude[bot] performs deep review, posts comment thread
            └─→ if copilot also produced a competing PR: scaleforce[bot] cross-links and summarizes diff
                 └─→ maintainer reviews synthesis, requests changes or approves
                      └─→ on approve + checks pass: maintainer merges
```

## Status checks expected on every PR

- CI: `npm test`, `npm run build`
- ADR check: if PR touches architecture-affecting paths, must include changes to `docs/adr/`
- Lint: TypeScript compile + future linter

## Branch targets

- Feature work → PR into `dev`
- Release → PR `dev` into `main`
- Hotfix → PR into `main`, then forward-port to `dev`

See [`../../docs/setup/branching.md`](../../docs/setup/branching.md) for detail.

## Conventions

- Title under 70 chars, imperative mood
- Body uses [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md)
- One logical change per PR
- Link spec/ADR/issue
