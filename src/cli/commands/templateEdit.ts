import type { StorageOptions } from '../../node/storage/storage.js';
import { loadTemplateFromStore, saveTemplate } from '../../node/storage/templates.js';
import type { Template } from '../../core/types/index.js';
import { parseTemplateJsonText } from '../../core/parsing/template.js';
import { TEMPLATE_SCHEMA_URL, X_PROMPTG_TIME } from '../../core/spec.js';
import { status } from '../cliKit.js';
import { RuntimeError, ValidationError } from '../errors.js';
import { editInEditor, writeTempFile } from './shared/editor.js';

export async function executeTemplateEdit(
  name: string,
  store: StorageOptions | undefined,
  options?: { quiet?: boolean }
): Promise<void> {
  const quiet = options?.quiet === true;
  const log = (msg: string) => {
    if (!quiet) status(msg);
  };

  const existing = await loadTemplateFromStore(name, store);
  const createdAt = existing[X_PROMPTG_TIME]?.createdAt ?? new Date().toISOString();
  const initial = JSON.stringify({ $schema: TEMPLATE_SCHEMA_URL, ...existing }, null, 2);

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

  const normalized: Template = parsed.value[X_PROMPTG_TIME]?.createdAt
    ? parsed.value
    : { ...parsed.value, [X_PROMPTG_TIME]: { createdAt } };

  await saveTemplate(normalized, store);
  log(`Saved template "${name}".`);
}
