# Contributing to PromptG CLI

For any changes to the command surface (args/flags) it will require discussion first, please raise an issue.

## Requirements

- Node.js version in `package.json` `engines`
- npm

## Setup

```bash
git clone https://github.com/promptg/cli.git
cd cli
npm ci
```

## Commands

```bash
npm run typecheck
npm test
npm run lint
npm run build
node dist/cli.js --help
```

## PR Guidelines

- Keep changes small and focused.
- Include what changed, why, and how you tested.

## DCO

All commits must include a Signed-off-by line (DCO). Use:

```bash
git commit -s
```
