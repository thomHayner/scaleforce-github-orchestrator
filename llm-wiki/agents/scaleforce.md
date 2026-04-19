# scaleforce[bot]

This repo's Probot. The orchestration layer.

## Identity

- GitHub App: `ScaleForce`
- Bot username: `scaleforce[bot]`
- Owner: `ScaleForceAgency` org (when transferred)
- Source: this repo (`src/`)

## Role

- Triage new issues; apply primary labels
- Route conversations through intake → duplicate-check → report workflows
- Mediate PR review threads (planned)
- Coordinate `@claude` and Copilot interactions in threads (planned)

## What it does NOT do

- Does not write or edit code
- Does not author commits
- Does not respond on behalf of the maintainer
- Does not @-mention itself

## Permissions

See [`app.yml`](../../app.yml). Currently: `issues: write`, `metadata: read`. Will expand to `pull_requests: write` when PR orchestration is added.

## Webhooks subscribed

See [`src/index.ts`](../../src/index.ts). Currently: `issues.opened`, `issue_comment.created`.
