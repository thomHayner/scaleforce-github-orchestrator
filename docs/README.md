# docs/

The product layer — what we're building, why, and the decisions that shape it. Versioned with the code, reviewable in PRs.

## Layout

| Folder | Contents |
|---|---|
| [`vision/`](vision/) | The "why" — vision statements, north-star principles, target users |
| [`prd/`](prd/) | Product requirements documents, feature briefs |
| [`specs/`](specs/) | In-flight technical specs (paired with issues/PRs) |
| [`roadmap/`](roadmap/) | What's next, ordered by priority and quarter |
| [`architecture/`](architecture/) | High-level system designs, diagrams, integration maps |
| [`adr/`](adr/) | Architecture Decision Records (MADR format) |
| [`setup/`](setup/) | Operational docs: branching, bot identities, deploy |
| `drafts/` | Scratch space for AI-generated drafts awaiting human review (created on demand) |

## Where this layer ends

`docs/` is human-curated source-of-truth. It is **not** the place for ephemeral chatter, generated summaries, or agent scratch notes — those go in PR threads or [`llm-wiki/`](../llm-wiki/).
