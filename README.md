# PromptG CLI

[![license](https://img.shields.io/npm/l/@promptg/cli)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@promptg/cli)](https://www.npmjs.com/package/@promptg/cli)
[![CI](https://github.com/promptg/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/promptg/cli/actions/workflows/ci.yml)

PromptG makes managing, editing and rendering dynamic AI prompts on the fly effortless

- Create/manage/edit collections of prompts easily
- Runs from command line, can pipe into anything.. e.g. ollama, CI, git hooks
- Render variations of prompts on the fly, inject {{variables}} or inject files.. e.g. git diffs or documents
- Can store prompts globally `~/.promptg/` or in projects `.promptg/`, run anywhere

## Quickstart

```bash
# Install
npm install -g @promptg/cli


# Create a prompt, paste in text
promptg prompt new my-prompt

# Or pipe to create, + add dynamic variables
echo "Review this {{lang}} source code: {{code}}. Suggest improvements." | promptg prompt save code-review

# Render a simple text prompt
promptg get my-prompt

# Render with dynamic values, insert files
promptg get code-review --var lang=Python --var code@myfile.py | ollama run mistral

# Create a prompt store in your project, share with others/team (.promptg/)
promptg init
```

Full CLI reference: [docs/CLI.md](docs/CLI.md)

## The `.promptg/` folder

Your global prompts get stored in `~/.promptg/`, you can run these anywhere.

To set up a local repo in a project, just run the init command

```bash
promptg init
```

It creates a project store at `.promptg/` with this structure:

```
.promptg/
|---- prompts/                 # Prompt documents
|---- templates/               # Prompt templates
`---- packs/                   # Bundles of prompts
```

PromptG autodetects this and picks up prompts in the project.

- The prompts are part of the code, other developers/team members can run the same prompts
- Add a `.promptg/` folder to your work or Open Source project to guide contributors and help maintain consistency
  - **pre-pr-check** A prompt of things you want checked before devs raise a PR (tests, docs, breaking changes check, changelog, screenshots, etc.)
  - **new-feature** A prompt to guide/shape new features, specifying conventions or constraints
  - **update-documentation** Provide structure to help devs add to documentation in a way that conforms to project
  - **changelog/release-notes-writer** Help generate these in a repeatable and consistent way.

## Prompt files

Prompts are stored in the `.promptg/` folder as json files.

Editing JSON sucks - The CLI always lets you work in plain text.

The files are in JSON to allow storage of extra structured data, like default template values, and allow further extension.

```json
{
  "schemaVersion": "1",
  "kind": "prompt",
  "name": "review",
  "content": "Review this {{language}} code, emphasis on {{focus}}.\n\n Here is the code:  {{diff}}",
  "defaults": {
    "language": "Python",
    "focus": "Security"
  }
}
```

## Packs

PromptG lets you package up prompts into packs that you can share and install.

```bash
# Share
promptg pack build my-pack --pack-version 1.0.0
promptg pack install ./path/to/pack.json (or URL)
```

Packs are versioned bundles of prompts you can share via URL or file.

See [PromptG Starter Packs](https://github.com/promptg/starter-packs) for examples.

## Other CLI features

- Clean stream separation: machine output to stdout, status/warnings/errors to stderr (--quiet suppresses status).
- First-class JSON mode: --format json / --json returns structured envelopes (ok/data/warnings + ok=false/error{code,message,details}), including --help / --version.
- Stable exit codes: 0 success, 1 validation/runtime, 2 usage, 130 canceled.
- Debuggable failures: --debug adds stack/cause into JSON details (and prints stack in text mode).
- Pipeline-friendly: prompt save <name> reads from stdin; render prints prompt text by default.
- Store scopes: --store auto|project|global with project auto-detect (.promptg/) + fallback behavior.
- Reliability/CI: atomic writes, validate command that exits non-zero on issues, plus doctor diagnostics with JSON output.

## Common commands

```bash
# Discover / diagnose
promptg --help
promptg status
promptg store path --store project
promptg doctor
promptg version

# Prompts: list + inspect
promptg prompt list
promptg prompt list --long
promptg prompt list --filter security
promptg prompt show code-review
promptg prompt show code-review --format json

# Prompts: render
promptg get code-review
promptg get code-review --info
promptg get code-review --unfilled
promptg get code-review --var language=TypeScript --var diff@./diff.txt
promptg get code-review --interactive
promptg get code-review --copy
promptg get code-review --format json

# Prompts: edit + metadata + rename + delete
promptg prompt edit code-review
promptg prompt edit code-review --raw
promptg prompt meta code-review --description "Review for security" --tag security --tag review
promptg prompt rename code-review security-review
promptg prompt delete security-review

# Templates
promptg template list --long
promptg template show pr-review --embedded
promptg template new pr-review
promptg template edit pr-review
promptg template delete pr-review

# Import JSON (file or URL)
promptg import ./my-prompt.json
promptg import https://example.com/prompt.json
promptg import ./my-prompt.json --force

# Packs (build + install)
promptg pack build my-pack --pack-version 1.0.0
promptg pack install ./pack.json
promptg pack install ./pack.json --only-new
promptg pack install ./pack.json --force

# CI-friendly validation (non-zero exit on issues)
promptg validate
promptg validate --format json
```

## Documentation

- Full CLI reference: [docs/CLI.md](docs/CLI.md)
- Schemas (vendored for offline use + editor tooling): [schemas/README.md](schemas/README.md)
- Spec: https://github.com/promptg/spec

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Security

See [SECURITY.md](SECURITY.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
