# 0002. Use `feature → dev → main` branch model

- **Status**: accepted
- **Date**: 2026-04-18
- **Deciders**: @thomHayner
- **Tags**: process, branching

## Context and Problem Statement

The maintainer works alongside multiple AI agents that may produce parallel PRs. We need a branch model that:

- Lets the maintainer iterate quickly with agents (sometimes committing directly without ceremony).
- Provides a clear staging area where multiple in-flight changes can integrate before release.
- Keeps `main` stable and release-only.

## Decision Drivers

- Agents producing parallel PRs need a common integration target that isn't `main`.
- The maintainer should not be forced through a feature-branch ceremony for every small change.
- `main` must remain a clean, releasable history.

## Considered Options

- **Trunk-based, PRs to `main` only**: simplest, but no staging buffer for multi-agent integration.
- **GitFlow** (`feature` → `develop` → `release` → `main` + hotfix): too heavy.
- **`feature/* → dev → main`**: `dev` is the integration branch; feature branches optional; release-time PR from `dev` to `main`.

## Decision Outcome

Chosen: **`feature/* → dev → main`**.

- `main`: protected, release-only. Required reviews. No direct pushes.
- `dev`: working integration branch. Direct commits permitted when iterating with the maintainer. Long-running.
- `feature/*`: optional. Used when work is large enough to deserve isolation, or when multiple agents are working in parallel.
- Release: PR from `dev` to `main`. Tag and release from `main`.

### Consequences

- Good: matches actual workflow — quick iteration on `dev`, clean `main`.
- Good: gives parallel agent PRs an integration target without polluting `main`.
- Bad: requires explicit release discipline ("when do we cut from `dev` to `main`?").
- Neutral: `dev` history will be messier than `main`. That's the tradeoff.
