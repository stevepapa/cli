import type { StorageOptions } from '../../node/storage/storage.js';
import {
  loadTemplateFromStore,
  saveTemplate,
  templateExistsInStore,
} from '../../node/storage/templates.js';
import type { Template } from '../../core/types/index.js';
import { parseTemplateJsonText } from '../../core/parsing/template.js';
import {
  PROMPT_SCHEMA_VERSION,
  TEMPLATE_SCHEMA_URL,
  TEMPLATE_SCHEMA_VERSION,
  X_PROMPTG_TIME,
} from '../../core/spec.js';
import { status } from '../cliKit.js';
import { RuntimeError, UsageError, ValidationError } from '../errors.js';
import { validateKebabCaseName } from '../../core/lib/names.js';
import { editInEditor, writeTempFile } from './shared/editor.js';

function createTemplateSkeleton(name: string, createdAt: string): Template & { $schema?: string } {
  return {
    $schema: TEMPLATE_SCHEMA_URL,
    kind: 'template',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    name,
    displayName: name,
    description: 'TODO: describe this template',
    prompt: {
      kind: 'prompt',
      schemaVersion: PROMPT_SCHEMA_VERSION,
      name,
      content: 'TODO: write prompt content (supports {{vars}})',
    },
    [X_PROMPTG_TIME]: { createdAt },
  };
}

export async function executeTemplateNew(
  name: string,
  store: StorageOptions | undefined,
  options?: { force?: boolean; quiet?: boolean }
): Promise<void> {
  const quiet = options?.quiet === true;
  const force = options?.force === true;
  const log = (msg: string) => {
    if (!quiet) status(msg);
  };

  const nameErr = validateKebabCaseName(name);
  if (nameErr) throw new UsageError(nameErr);

  const exists = await templateExistsInStore(name, store);
  let createdAt = new Date().toISOString();
  let initial: string;

  if (exists) {
    if (!force)
      throw new ValidationError(`Template "${name}" already exists. Use --force to overwrite.`);
    const existing = await loadTemplateFromStore(name, store);
    createdAt = existing[X_PROMPTG_TIME]?.createdAt ?? createdAt;
    initial = JSON.stringify({ $schema: TEMPLATE_SCHEMA_URL, ...existing }, null, 2);
    log(`Overwriting existing template "${name}".`);
  } else {
    initial = JSON.stringify(createTemplateSkeleton(name, createdAt), null, 2);
  }

  const edited =
    (await editInEditor({
      initial,
      filenameHint: name,
    })) ?? null;

  if (edited === null) throw new RuntimeError('Editor not available or failed to launch.');

  const parsed = parseTemplateJsonText(edited);
  if (!parsed.ok) {
    const tempPath = await writeTempFile({
      prefix: 'promptg-template',
      filenameHint: name,
      ext: '.json',
      content: edited,
    });
    throw new ValidationError(`Invalid template JSON: ${parsed.error}`, {
      hints: [`Your edit was saved to: ${tempPath}`],
    });
  }

  if (parsed.value.name !== name) {
    throw new ValidationError(
      'Cannot change template "name" in editor. Create a new template instead.'
    );
  }

  // Preserve existing createdAt on overwrite if the edit removed it.
  const normalized: Template = parsed.value[X_PROMPTG_TIME]?.createdAt
    ? parsed.value
    : { ...parsed.value, [X_PROMPTG_TIME]: { createdAt } };

  await saveTemplate(normalized, store);
  log(`Saved template "${name}".`);
}
