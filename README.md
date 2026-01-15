# PromptG CLI

[![license](https://img.shields.io/npm/l/@promptg/cli)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@promptg/cli)](https://www.npmjs.com/package/@promptg/cli)
[![CI](https://github.com/promptg/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/promptg/cli/actions/workflows/ci.yml)

```bash
npm install -g @promptg/cli
```

## What is this

Less command line gymnastics. Version prompts, render with variables, insert code/files, pipe to any LLM.

```bash
# Before
cat prompt.txt | sed "s/{{lang}}/Python/g; s/{{code}}/$(cat app.py)/g" | ollama run mistral

# With promptg:
promptg get code-review --var lang=Python --var code@app.py | ollama run mistral
```

## Who is this for?

You don't need this for a few prompts you paste into ChatGPT.

You might want this if you're managing lots of prompts, scripting prompts, inserting file contents, or keeping a team on the same prompt versions.

## Getting Started

```bash
# Store once
echo "Refactor this {{language}} code for better {{focus}}. Suggest improvements in readability, performance, and maintainability. Output refactored code and explanations." | promptg prompt save code-refactor

# Or edit prompts in default editor
promptg prompt new code-refactor

# Use everywhere
promptg get code-refactor --var language=Python --var focus=Security | llm

# Version in Git, share with your team, run in CI
git add .promptg/ && git commit -m "Add code refactor prompt"
```

## Examples

### Reuse prompts globally without scattered text files

```bash
# Save once
echo "Write a clear PR description (summary, rationale, risks, testing) for this diff:\n\n{{diff}}" | promptg prompt save pr-desc
echo "Write an imperative commit message for this diff:\n\n{{diff}}" | promptg prompt save commit-msg

# Reuse forever (no temp prompt files)
git diff --staged > /tmp/diff.txt
promptg get pr-desc --var diff@/tmp/diff.txt | llm > PR.md
promptg get commit-msg --var diff@/tmp/diff.txt | llm | head -n 1
```

### You run the same prompt with different inputs

```bash
# Compare outputs across models
for model in llama3.1 mistral deepseek; do
  promptg get review --var code@app.py | ollama run $model > "review-$model.txt"
done

# Run it on every file in a directory
for file in docs/*.md; do
  promptg get summarize --var content@"$file" | llm > "${file%.md}-summary.txt"
done

# Translate to multiple languages
for lang in Spanish French German Italian; do
  promptg get translate --var lang=$lang --var doc@README.md | llm > "README.$lang.md"
done
```

### CI/CD Integration

```yaml
# .github/workflows/pr-review.yml
- run: npm install -g @promptg/cli
- run: |
    git diff origin/main > diff.txt
    promptg get code-review --var diff@diff.txt | llm > review.md
    gh pr comment -F review.md
```

### Your team needs the same prompts

```bash
# You: create a project store
promptg init

# Save your prompts and prompt templates, then commit to the project repo

git add .promptg/ && git commit -m "Add project prompts"

# New dev runs:
git clone your-repo
cd your-repo
promptg list

# They see:
# - code-review: Your team's code review standard
# - commit-msg: Commit message format
# - pr-summary: PR description template
```

Prompts live in `.promptg/` and get committed with your code.

### You share prompts with your team or users

```bash
# Build a pack (versioned collection)
promptg pack build dev-essentials --pack-version 1.0.0

# Distribute via URL or Git
promptg pack install https://promptg.io/dl/packs/promptg-pack-dev-essentials.json
promptg pack install ./promptg-pack-dev-essentials.json
```

Packs are versioned bundles of prompts and templates you can share via URL or file.

See [PromptG Starter Packs](https://github.com/promptg/starter-packs) for examples.

---

## How it works

### Prompts are JSON files

Lets us store structured data like default template values. You don't edit JSON, everything can be done in plain text through the CLI.

```json
{
  "schemaVersion": "1",
  "kind": "prompt",
  "name": "review",
  "content": "Review this {{language}} code for security and performance."
}
```

PromptG renders them to plain text:

```bash
promptg get review --var language=TypeScript
# Output: Review this TypeScript code for security and performance.
```

Pipe the output anywhere. PromptG doesn't care which LLM you use.

### Packs distribute collections

```json
{
  "kind": "pack",
  "name": "team-essentials",
  "version": "1.2.0",
  "prompts": [...]
}
```

One command installs everything:

```bash
promptg pack install ./promptg-pack-team-essentials.json
```

## The `.promptg/` folder

```bash
promptg init  # Creates this structure
```

```
.promptg/
--- prompts/          # Your prompt instances
--- templates/        # Reusable blueprints
--- packs/            # Distribution bundles
```

Commit it to Git. New team members get the prompts when they clone the repo.

---

## Quick reference

```bash
# Create & save
promptg init
promptg prompt new hello              # Create in $EDITOR
echo "content" | promptg prompt save hi

# Use
promptg get hello                     # Render to stdout
promptg get review --var lang=Go      # With variables
promptg get review --var code@app.go  # From file
promptg get review | llm              # Pipe to LLM

# Discover
promptg prompt list
promptg prompt show code-review
promptg template list --tag security

# Share
promptg pack build my-pack --pack-version 1.0.0
promptg pack install ./path/to/pack.json

# CI/CD
promptg validate  # Validate all files
```

Full docs: [docs/CLI.md](docs/CLI.md)

---

## Design principles

PromptG sticks to basics: it outputs plain text you can pipe anywhere (like cat but for prompts), works with any LLM without lock-in, and stores everything as git-friendly JSON files in `.promptg/` so you can version, branch, or PR them like code. If the tool vanishes, your data is just portable files with an open spec, no drama.

---

## FAQ

**Can I still use ChatGPT/Claude/my-favorite-tool?**

Yes. PromptG outputs plain text. Pipe it wherever you want:

```bash
promptg get review | pbcopy  # Copy to clipboard, paste in ChatGPT
promptg get review | ollama run mistral  # Use llm CLI
promptg get review | claude -p # Use Claude CLI
```

**Do I need to learn JSON?**

No. Editing JSON sucks - CLI lets you work in plain text.
Prompt files are in JSON to store extra metadata.. (e.g. default template values)

```bash
echo "your prompt text" | promptg prompt save name
promptg prompt edit name  # Opens in your $EDITOR
```

You can hand-edit JSON if you want. You don't have to.

**What if I want to stop using PromptG?**

You have JSON files. Read them with `cat`, parse with `jq`, convert with a script. The [spec](https://github.com/promptg/spec) is public. Migration to anything else takes minutes.

**Does this work offline?**

Yes. PromptG is a local CLI. No network, no accounts, no API keys. Your prompts live on your disk.

---

## Documentation

- [CLI Reference](docs/CLI.md)
- [Schemas](schemas/README.md)
- [Spec](https://github.com/promptg/spec)
- [Starter Packs](https://github.com/promptg/starter-packs)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

---

## License

Apache-2.0. See [LICENSE](LICENSE)
