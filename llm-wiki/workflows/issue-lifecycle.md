# Issue lifecycle

How a new issue moves from "filed" to "actioned."

```
opened
  └─→ scaleforce[bot] adds `intake` label, greets the user
       └─→ scaleforce[bot] applies primary label (bug/documentation/enhancement/question)
            └─→ scaleforce[bot] runs duplicate check (labels `unique` or `duplicate`)
                 └─→ scaleforce[bot] generates official issue report from the .yml template
                      └─→ maintainer triages → assigns to claude[bot] or copilot, or themselves
```

Source: [`src/workflows/issueIntake.ts`](../../src/workflows/issueIntake.ts), [`src/workflows/issueWatcher.ts`](../../src/workflows/issueWatcher.ts).

## Labels

| Label | Applied by | Meaning |
|---|---|---|
| `intake` | scaleforce[bot] | Issue is in initial triage; AI is gathering info |
| `bug` / `documentation` / `enhancement` / `question` | scaleforce[bot] | Primary classification |
| `unique` / `duplicate` | scaleforce[bot] | Result of duplicate check |
| `good first issue`, `help wanted`, etc. | maintainer | Standard triage |

## When to assign to which agent

- **claude[bot]**: tasks requiring deep context, spec drafting, multi-file changes, architecture decisions.
- **copilot-swe-agent[bot]**: well-scoped, single-feature tasks where parallel implementation is useful.
- **maintainer**: anything requiring product judgment or external coordination.
