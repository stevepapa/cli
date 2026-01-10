# PromptG Schemas (Vendored Copy)

WARNING **These are vendored snapshots for offline use and editor tooling.**

**Canonical source:** [promptg/spec](https://github.com/promptg/spec)

## Schema Files

- **[prompt.schema.json](prompt.schema.json)** - Schema for saved prompts
- **[template.schema.json](template.schema.json)** - Schema for reusable templates
- **[pack.schema.json](pack.schema.json)** - Schema for prompt packs

These schemas enable:

- IDE autocomplete and validation (when `$schema` is set in JSON files)
- Offline development without network dependencies
- CLI runtime validation

## Canonical URLs

The `$id` fields in these schemas reference the canonical URLs:

- `https://promptg.io/schemas/v1/prompt.schema.json`
- `https://promptg.io/schemas/v1/template.schema.json`
- `https://promptg.io/schemas/v1/pack.schema.json`

These URLs should be used in `$schema` fields of PromptG documents for editor tooling.

## Examples

For reference examples, see: https://github.com/promptg/spec

## Using the Schemas

### Validation (Node.js)

```bash
npm install ajv ajv-formats
```

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';

const ajv = new Ajv({ strict: false });
addFormats(ajv);

const schema = JSON.parse(readFileSync('prompt.schema.json', 'utf-8'));
const validate = ajv.compile(schema);

const prompt = JSON.parse(readFileSync('my-prompt.json', 'utf-8'));

if (!validate(prompt)) {
  console.error('Validation errors:', validate.errors);
} else {
  console.log('Valid!');
}
```

### Validation (Python)

```bash
pip install jsonschema
```

```python
from jsonschema import validate
import json

with open('prompt.schema.json') as f:
    schema = json.load(f)

with open('my-prompt.json') as f:
    prompt = json.load(f)

validate(instance=prompt, schema=schema)  # Raises exception if invalid
print("Valid!")
```

### Validation (CLI)

```bash
npm install -g @promptg/cli
promptg validate
```

## When to Update

Sync these schemas when:

- A new spec version is released
- Schema fixes or clarifications are published
- Starting work on CLI features that depend on schema changes
- Preparing a new CLI release

## How to Update

1. Copy from `promptg/spec/schemas/v1/*.json` to this directory
2. Keep `$id` URLs unchanged (they reference promptg.io, not this repo)
3. Run CLI tests to ensure compatibility: `npm test`
4. Update CLI version if schema changes introduce breaking changes

## Full Specification

For the complete specification including:

- Normative behavior and semantics
- Variable interpolation rules
- Security considerations
- Implementation limits
- Conformance requirements

See: **https://github.com/promptg/spec**

## Contributing

Schema issues should be reported to the canonical spec repo:

- **Issues:** https://github.com/promptg/spec/issues
- **Schema changes:** Must be proposed in promptg/spec first

CLI-specific integration issues can be reported here.
