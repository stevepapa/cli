# PromptG

**Prompts as code. Versioned, shareable, standard.**

[![npm version](https://img.shields.io/npm/v/@promptg/cli)](https://www.npmjs.com/package/@promptg/cli)
[![CI](https://github.com/promptg/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/promptg/cli/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

PromptG is a tool for managing AI prompts as versioned JSON files, allowing easy storage, sharing, and rendering to plain text for use with any LLM.

```bash
promptg get code-review | llm
```

## Quickstart (60 seconds)

Requirements: Node.js 20.12+

```bash
# Install
npm install -g @promptg/cli

# Create a project store (.promptg/)
promptg init
```

Create a prompt (stdin -> stored JSON):

```bash
echo "Review this code for correctness, security, and performance." | promptg prompt save code-review
```

Render it (stdout -> pipe anywhere):

```bash
promptg get code-review | llm
```

## CLI (scriptable, pipe-friendly)

The CLI is designed for automation: render prompts to stdout, inject runtime context via variables, and pipe into any runner.

```bash
# With variables
promptg get code-review --var language=Python --var focus=security | llm

# Load multiline values from a file (diffs/logs/etc.)
git diff > pr-diff.txt
promptg get pr-review --var diff@pr-diff.txt | llm
```

## How It Works

- Store prompts/templates as JSON in a user store (`~/.promptg/`) or a project store (`.promptg/`).
- Render prompts with `promptg get <name>` (plain text to stdout).
- Templates are not rendered; instantiate them into prompts with `promptg prompt new <prompt-name> --from-template <template>`.
- Share across repos/teams by committing `.promptg/` or distributing packs.

## Core Concepts

- **Prompt**: a ready-to-run, concrete prompt. It has final-ish text (may still include variables) and is meant to be rendered and used directly via `promptg get <name>`.
- **Template**: a reusable **blueprint** designed to be instantiated into prompts. It's the portable, shareable source-of-truth for a workflow (PR review, release notes, issue triage), and can include defaults + optional interactive metadata.
- **Pack**: a versioned bundle of prompts/templates for sharing across repos.

## Blueprints -> Instances

The intended workflow is:

- Install or author **templates** (blueprints) once.
- Create **prompts** (instances) from templates for a specific repo/team/task.
- Dispose/regenerate prompts freely as your context changes; keep templates stable.

**Why templates require metadata:**

- **Catalog separation**: tools can separate a "Template Catalog" (browse blueprints) from "My Prompts" (execute instances), reducing noise.
- **Catalog quality**: required `displayName`/`description` ensures useful browsable views.

**Quick examples:**

```bash
promptg prompt new my-pr-review --from-template pr-review --var diff@changes.txt
promptg get my-pr-review | llm
echo "Review code" | promptg prompt save code-review         # Save prompt
promptg get code-review | llm                               # Execute prompt
```

## Ecosystem

- **You are in `promptg/cli`**: the reference implementation (CLI). CLI docs live in `docs/`.
- **Format/spec**: https://github.com/promptg/spec (canonical spec, schemas, implementer guide). PromptG documents use `schemaVersion: "1"`.
- **Conceptual model**: https://github.com/promptg/spec/blob/main/spec/promptg-spec.md#2-core-concepts-and-rationale-informative
- **Website**: https://promptg.io (landing page, hosted schemas, pack mirror).

**Routing:**

- CLI bugs/features: https://github.com/promptg/cli/issues
- Spec/schema issues: https://github.com/promptg/spec/issues

## One Prompt Source. Everywhere You Work.

PromptG stores prompts/templates as JSON in git and renders plain text you can use in LLM runners, CI, and editor extensions -- you choose.

- **Stop Slack prompts**: the same prompt works for devs and CI.
- **No prompt drift**: changes are reviewed, versioned, and reproducible.
- **Templates + variables**: one standard prompt, many contexts.
- **Tool-agnostic**: swap models/tools without rewriting prompts.

## Documentation

- [CLI Reference](docs/CLI.md)
- [Format Specification](https://github.com/promptg/spec) (canonical spec)
- [Vendored Schemas](schemas/README.md) (offline copy)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Support

- Bug reports and feature requests: https://github.com/promptg/cli/issues
- Format/spec questions: https://github.com/promptg/spec

## Release Workflow

- Changes land via PRs to `main`.
- Releases are tagged from `main` as `vX.Y.Z` and published to npm as `@promptg/cli`.

## License

Apache-2.0
