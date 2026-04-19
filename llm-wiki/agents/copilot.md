# copilot-swe-agent[bot]

GitHub's parallel coding agent.

## Identity

- Bot username: `copilot-swe-agent[bot]` (when the coding agent acts)
- Source: GitHub Copilot, configured in repo settings
- Distinct from inline Copilot suggestions in the editor — the SWE agent opens PRs

## How to invoke

- Assign an issue to Copilot
- Use the "Code with Copilot" UI in PR view
- (Future) `@copilot` mentions if/when supported

## Role in this stack

Often produces a parallel implementation alongside Claude's, especially when the task is well-scoped. The maintainer (or `scaleforce[bot]` mediation) compares outputs and chooses or merges.

## Notes

- Copilot's coding agent is the only third-party identity that GitHub gives the purple **AI** pill — because it's a GitHub product. Claude and ScaleForce get the gray **bot** pill.
- Copilot follows `.github/copilot-instructions.md` if present (create when needed).
