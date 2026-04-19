# ScaleForce

> A GitHub-native orchestration bot built with [Probot](https://github.com/probot/probot) and integrated with [OpenAI](https://platform.openai.com). ScaleForce triages issues, mediates PR review threads between human and AI contributors (Claude, Copilot), and coordinates the agentic dev workflow inside the repo.

Posts as `scaleforce[bot]`. Lives alongside `claude[bot]` (substantive AI work) and `copilot-swe-agent[bot]` (parallel coding agent), with the human maintainer as the final reviewer.

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t scaleforce-bot .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> scaleforce-bot
```

## Repo conventions

- See [`CLAUDE.md`](../CLAUDE.md) and [`AGENTS.md`](../AGENTS.md) for agent rules.
- See [`docs/`](../docs/) for product docs (vision, PRDs, specs, ADRs, roadmap).
- See [`docs/setup/branching.md`](../docs/setup/branching.md) for the branch model.
- ADRs use [MADR](https://adr.github.io/madr/) format in [`docs/adr/`](../docs/adr/).

## Contributing

Open an issue or start a Discussion. PRs welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[ISC](../LICENSE) © 2024 thomHayner
