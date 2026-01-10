# PromptG CLI

Developer-first reference for the PromptG CLI (`promptg`).

## Installation

```bash
npm install -g @promptg/cli
```

## Quickstart

```bash
# Create a project store (.promptg/)
promptg init

# Save a prompt (stdin -> stored JSON)
echo "Review this code for security and correctness." | promptg prompt save code-review

# Render to stdout (pipe anywhere)
promptg get code-review | llm
```

Variables:

```bash
git diff > diff.txt
promptg get pr-review --var diff@diff.txt --var language=TypeScript | llm
```

## Global Options

These options are defined on the root CLI and work with all commands:

- `--format <format>`: `text|json` (default: `text`)
- `--json`: shorthand for `--format json`
- `-q, --quiet`: suppress non-essential status output (stderr)
- `--debug`: include diagnostic details in JSON errors (and print stacks in text mode)

## Common Options

These options are common across many commands:

- `--store <store>`: `auto|project|global` (default: `auto`)
- `--var <key=value|key@filepath>`: variable override (repeatable) (get/prompt render/prompt new --from-template)
- `-i, --interactive`: prompt for variables (TTY only) (get/prompt render/prompt new --from-template)
- `--copy`: copy rendered output to clipboard (where supported)

## Aliases

- `promptg p` = `promptg prompt`
- `promptg t` = `promptg template`
- `promptg get <name>` = `promptg prompt render <name>`
- `list` has alias `ls` (e.g., `promptg prompt ls`)
- `delete` has alias `rm` (e.g., `promptg prompt rm`)

## Commands

### `promptg init`

Initialize a `.promptg/` folder in your project.

```bash
promptg init
```

Creates:

- `.promptg/prompts/` - For saved prompts
- `.promptg/templates/` - For reusable templates
- `.promptg/packs/` - For prompt packs

**Options:**

- `-q, --quiet` - Suppress status output (stderr)

### `promptg prompt save <name>`

Save a prompt from stdin.

```bash
echo "Review this code for security" | promptg prompt save security-review

# Or from a file
cat my-prompt.txt | promptg prompt save my-prompt
```

Notes:

- This command requires stdin (piped/redirected). It will error if you run it with no input.

**Options:**

- `--store <mode>` - Specify store location
- `-q, --quiet` - Suppress status output (stderr)

### `promptg prompt new <name>`

Create a new prompt (from scratch or from a template).

```bash
promptg prompt new code-review
promptg prompt new my-pr-review --from-template pr-review
```

Notes:

- Without `--from-template`, uses your configured editor (commonly `$VISUAL` / `$EDITOR`) to capture multiline content.
- With `--from-template`, deep copies the embedded prompt in the template (wrapper metadata is ignored).

**Options:**

- `--force` - Overwrite if already exists
- `--from-template <template-name>` - Create by instantiating a template
- `--var <key=value|key@filepath>` - Seed `defaults` on the created prompt (repeatable; requires `--from-template`)
- `--interactive` - Prompt for missing defaults (TTY only; requires `--from-template`)
- `--store <mode>` - Specify store location
- `-q, --quiet` - Suppress status output (stderr)

### `promptg prompt edit <name>`

Edit an existing prompt in your editor.

```bash
promptg prompt edit code-review
```

Notes:

- Default mode edits prompt content only (multiline supported).
- Use `--raw` to edit the full prompt JSON document (metadata, defaults, interactive).
- Uses your configured editor (commonly `$VISUAL` / `$EDITOR`).

**Options:**

- `--raw` - Edit the full prompt JSON document
- `--store <mode>` - Specify store location
- `-q, --quiet` - Suppress status output (stderr)

### `promptg prompt rename <old> <new>`

Rename a prompt (atomic).

```bash
promptg prompt rename code-review security-review
```

**Options:**

- `--force` - Overwrite if target exists
- `--store <mode>` - Specify store location
- `-q, --quiet` - Suppress status output (stderr)

### `promptg prompt meta <name>`

Edit prompt metadata (display name, description, tags).

```bash
promptg prompt meta code-review --description "Review code for security" --tag security --tag review
```

**Options:**

- `--display-name <value>` - Set display name
- `--description <value>` - Set description
- `--tag <tag>` - Add tag (repeatable)
- `--remove-tag <tag>` - Remove tag (repeatable)
- `--store <mode>` - Specify store location
- `-q, --quiet` - Suppress status output (stderr)

### `promptg prompt delete <name>`

Delete a prompt.

```bash
promptg prompt delete code-review
promptg prompt rm code-review
```

**Options:**

- `--store <mode>` - Specify store location
- `-q, --quiet` - Suppress status output (stderr)

### `promptg prompt show <name>`

Show a prompt as JSON (does not render).

```bash
promptg prompt show code-review
promptg prompt show code-review --format json
```

**Options:**

- `--store <mode>` - Specify store location
- `--format <format>` / `--json` - Output format (text|json)

### `promptg prompt render <name>`

Render a prompt.

Alias: `promptg get <name>`.

### `promptg get <name>`

Retrieve and render a prompt.

Alias: `promptg prompt render <name>`.

```bash
# Basic usage
promptg get code-review

# With variables
promptg get code-review --var language=TypeScript --var focus=security

# Load variable from file
promptg get code-review --var diff@changes.txt

# Interactive mode
promptg get code-review --interactive

# Copy to clipboard
promptg get code-review --copy

# JSON output
promptg get code-review --format json
```

Notes:

- `--store auto` prefers the nearest project store and falls back to global if the prompt is missing.
- In text mode, `get` may warn if a project prompt overrides a global prompt with the same name.

**Options:**

- `--var <key=value>` - Override variable (repeatable)
- `--var <key@filepath>` - Load variable from file
- `--interactive` - Prompt for variables interactively
- `--info` - Show metadata + rendered output
- `--unfilled` - Show template with placeholders
- `--copy` - Copy output to clipboard
- `--quiet` - Suppress status messages
- `--store <mode>` - Specify store location
- `--format <format>` / `--json` - Output format (text|json)

### `promptg template show <name>`

Show a template as JSON. Templates are not rendered/executed.

```bash
promptg template show pr-review
promptg template show pr-review --embedded
promptg template show pr-review --format json
```

**Options:**

- `--embedded` - Show embedded prompt JSON only
- `--store <mode>` - Specify store location
- `--format <format>` / `--json` - Output format (text|json)

### `promptg template new <name>`

Create a template by editing JSON in your editor.

```bash
promptg template new pr-review
```

Notes:

- Opens your editor to edit template JSON (useful for authoring metadata + interactive questions).

**Options:**

- `--force` - Overwrite if already exists
- `--store <mode>` - Specify store location
- `-q, --quiet` - Suppress status output (stderr)

### `promptg template edit <name>`

Edit an existing template JSON in your editor.

```bash
promptg template edit pr-review
```

Notes:

- Opens your editor to edit the template JSON.

**Options:**

- `--store <mode>` - Specify store location
- `-q, --quiet` - Suppress status output (stderr)

### `promptg template delete <name>`

Delete a template.

```bash
promptg template delete pr-review
promptg template rm pr-review
```

**Options:**

- `--store <mode>` - Specify store location
- `-q, --quiet` - Suppress status output (stderr)

### `promptg prompt list`

List all saved prompts.

```bash
# Text output
promptg prompt list

# JSON output
promptg prompt list --format json

# Filter and detailed output (text mode)
promptg prompt list --filter security
promptg prompt list --long
```

**Options:**

- `--store <mode>` - Specify store location
- `--format <format>` / `--json` - Output format (text|json)
- `--filter <substring>` - Filter prompts by name/description/tags
- `-l, --long` - Detailed output (text mode only)

### `promptg template list`

List all templates.

```bash
# Text output
promptg template list

# JSON output
promptg template list --format json

# Filter and detailed output (text mode)
promptg template list --filter review
promptg template list --long
```

**Options:**

- `--store <mode>` - Specify store location
- `--format <format>` / `--json` - Output format (text|json)
- `--filter <substring>` - Filter templates by name/description/tags
- `-l, --long` - Detailed output (text mode only)

### `promptg import <source>`

Import a prompt or template from a file or URL.

```bash
# From local file
promptg import ./my-prompt.json

# From URL
promptg import https://example.com/prompt.json

  # Force overwrite
  promptg import ./my-prompt.json --force
```

Notes:

- If the source starts with `http://` or `https://`, it is treated as a URL by default (use `--file` to force file mode).

**Options:**

- `--force` - Overwrite if already exists
- `--file` - Treat source as file path
- `--url` - Treat source as URL
- `--store <mode>` - Specify store location
- `-q, --quiet` - Suppress status output (stderr)

### `promptg pack build <name>`

Build a prompt pack for distribution.

```bash
promptg pack build my-pack --pack-version 1.0.0
```

**Options:**

- `--pack-version <semver>` - Pack version (semver)
- `--store <mode>` - Specify store location (auto|project|global)
- `--force` - Overwrite if the pack already exists
- `--quiet` - Suppress status output

Writes to `<store>/packs/promptg-pack-<name>.json`.

### `promptg pack install <source>`

Install a prompt pack.

```bash
# From local file
promptg pack install ./pack.json

# From URL
promptg pack install https://example.com/starter-pack.json

# Force overwrite
promptg pack install ./pack.json --force

# Install only new items
promptg pack install ./pack.json --only-new

  # Quiet mode
  promptg pack install ./pack.json --quiet
```

**Options:**

- `--force` - Overwrite existing prompts/templates
- `--only-new` - Skip items that already exist
- `--quiet` - Suppress status messages
- `--store <mode>` - Specify store location (auto|project|global)

### `promptg validate`

Validate prompts, templates, and packs in the selected store.

```bash
# Text output
promptg validate

# JSON output
promptg validate --format json
```

Checks:

- JSON syntax
- Schema compliance
- Variable references

**Options:**

- `--store <mode>` - Specify store location (auto|project|global)
- `--format <format>` / `--json` - Output format (text|json)
- `-q, --quiet` - Suppress status output (stderr)

### `promptg status`

Show current store configuration.

```bash
# Text output
promptg status

# JSON output
promptg status --format json
```

Displays:

- CLI version
- Current working directory
- Global store location
- Project store location (if detected)
- Store conventions

**Options:**

- `--format <format>` / `--json` - Output format (text|json)

### `promptg store path`

Print the resolved store root directory.

```bash
promptg store path
promptg store path --store project
promptg store path --store global
```

**Options:**

- `--store <mode>` - Specify store location (auto|project|global)

### `promptg doctor`

Diagnose common environment and store issues.

```bash
promptg doctor
promptg doctor --store project
promptg doctor --format json
```

**Options:**

- `--store <mode>` - Specify store location (auto|project|global)
- `--format <format>` / `--json` - Output format (text|json)

### `promptg version`

Print the CLI version.

```bash
promptg version
promptg version --format json
```

**Options:**

- `--format <format>` / `--json` - Output format (text|json)

## Variable Syntax

### Basic Substitution

```bash
--var key=value
```

### Multiline Content (Files)

Load variable value from a file (preserves newlines):

```bash
--var key@filepath
```

**Example:**

```bash
git diff > changes.txt
promptg get code-review --var diff@changes.txt | llm
```

**Constraints:**

- File must resolve within the current directory tree
- Maximum file size: 10MB
- Symlinks are resolved; the resolved target must still be within the current directory tree

### Interactive Mode

Define interactive variables in your prompt/template JSON:

```json
{
  "kind": "template",
  "schemaVersion": "1",
  "name": "my-template",
  "displayName": "Code Review Template",
  "description": "Interactive template for reviewing code with customizable language and focus",
  "prompt": {
    "kind": "prompt",
    "schemaVersion": "1",
    "name": "my-template",
    "content": "Review {{language}} code for {{focus}}",
    "x-promptg-interactive": {
      "language": {
        "question": "What programming language?",
        "help": "e.g., TypeScript, Python, Go"
      },
      "focus": {
        "question": "What should we focus on?",
        "required": true
      }
    }
  }
}
```

Then use `--interactive`:

```bash
promptg get my-prompt --interactive
```

## Store Management

### Store Modes

**Auto** (default):

- Detects `.promptg/` in current directory or parents
- Falls back to global if not found

**Project**:

- Forces project store
- Errors if no `.promptg/` found

**Global**:

- Forces global store (`~/.promptg/`)
- Ignores project stores

### Examples

```bash
# Use project store (error if not found)
promptg get code-review --store project

# Use global store
promptg get code-review --store global

# Auto-detect (default)
promptg get code-review
```

## Piping

PromptG is designed for Unix pipes:

```bash
# Pipe prompt to LLM
promptg get code-review | llm

# Provide multiline inputs (diffs/logs) via --var key@file
git diff > diff.txt
promptg get security-scan --var diff@diff.txt | llm

# Save LLM output
promptg get docs | llm > output.md
```

## JSON Output

Some commands support `--format json` (or `--json`) for programmatic use:

```bash
promptg prompt list --format json
promptg get code-review --format json
promptg template show pr-review --format json
promptg status --format json
promptg doctor --format json
promptg version --format json
promptg validate --format json
```

**Output format:**

```json
{
  "ok": true,
  "data": { ... },
  "warnings": []
}
```

Error format:

```json
{
  "ok": false,
  "error": {
    "code": "USAGE",
    "message": "..."
  },
  "warnings": []
}
```

## Exit Codes

- `0` - Success
- `1` - Validation or runtime error
- `2` - Usage error (invalid CLI syntax)
- `130` - Canceled (Ctrl+C during interactive prompts)

## Environment Variables

- `NO_COLOR` - Disable the small amount of colored stderr output (status/hints/separators)

## Examples

**Save and use a prompt:**

```bash
promptg init
echo "Review for security issues" | promptg prompt save security
git diff > diff.txt
promptg get security --var diff@diff.txt | llm
```

**Use variables:**

```bash
promptg get code-review \
  --var language=TypeScript \
  --var focus=performance
```

**Load diff from file:**

```bash
git diff origin/main...HEAD > pr-diff.txt
promptg get pr-review --var diff@pr-diff.txt | llm
```

**Interactive prompting:**

```bash
promptg get code-review --interactive --copy
```

**Install a pack:**

```bash
promptg pack install https://example.com/promptg-pack-typescript.json
promptg template list
```

## See Also

- [Format Specification](https://github.com/promptg/spec)

## Appendix: CLI Contract (v0)

### Output streams

- Text mode (default): stdout = primary output; stderr = status/warnings/errors.
- JSON mode (`--format json` / `--json`): stdout = valid JSON only (exactly one JSON value); stderr =
  empty by default (diagnostics only with `--debug`).

### JSON envelope (stable)

Success:

`{ "ok": true, "data": <any>, "warnings": [ { "code": "<string>", "message": "<string>" } ] }`

Error:

`{ "ok": false, "error": { "code": "USAGE|VALIDATION|RUNTIME", "message": "<string>", "details": { } }, "warnings": [ { "code": "<string>", "message": "<string>" } ] }`

- `warnings` is always present (possibly empty) and is advisory (it never flips `ok`).
- `error.details` is optional and must be JSON-serializable when present.
- JSON mode prints exactly one JSON object followed by a trailing newline.

### JSON help (stable)

- In JSON mode, `--help` returns:

`{ "ok": true, "data": { "help": "<string>" }, "warnings": [] }`

### Error codes (stable)

Top-level `error.code`:

- `USAGE` - invalid CLI usage / argument parsing / unsupported flag combinations.
- `VALIDATION` - invalid user data (bad JSON, schema/shape violations, missing required fields, name rules).
- `RUNTIME` - unexpected failures, including IO and network failures.

Infra-level error codes (e.g. `NOT_FOUND`, `CONFLICT`, `INVALID_DATA`, `NETWORK`) may be included under
`error.details` for debugging/tooling, but do not change the meaning of the top-level `error.code`
unless the contract is versioned.

### Exit codes (stable)

- `0` success; `1` validation/runtime error; `2` usage error; `130` canceled (Ctrl+C in interactive).

### Debug mode

- With `--debug`, extra diagnostics may appear under `error.details.debug` (e.g. stack, cause) without
  changing exit codes or top-level error semantics.
