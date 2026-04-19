# 0001. Record architecture decisions

- **Status**: accepted
- **Date**: 2026-04-18
- **Deciders**: @thomHayner
- **Tags**: process, governance

## Context and Problem Statement

ScaleForce is a multi-agent codebase where decisions are made in collaboration with AI contributors. PR threads, Slack-equivalents, and chat history are not durable enough to capture the *why* behind structural decisions — six months from now, neither the maintainer nor any agent will remember the rationale.

We need a lightweight, version-controlled way to record decisions so future contributors (human and AI) can see what was decided and why.

## Decision Drivers

- Agents need durable context to avoid re-litigating settled decisions.
- The maintainer wants to operate at the PM/reviewer level, not re-explain rationale repeatedly.
- Decisions should be reviewable in PRs, not buried in a wiki.

## Considered Options

- **MADR** (Markdown Any Decision Records): lightweight, popular, well-tooled.
- **Nygard original**: more formal, longer, less commonly used today.
- **No formal format**: ad-hoc decision notes scattered across `docs/`.

## Decision Outcome

Chosen: **MADR**, in [`docs/adr/`](.), one file per decision, sequentially numbered.

### Consequences

- Good: agents and humans have a stable place to look up "why is it this way?"
- Good: decisions are reviewed and discussed in PRs.
- Bad: small process overhead — every architecture-affecting PR must add or update an ADR.
- Neutral: existing decisions need to be backfilled as ADRs over time.
