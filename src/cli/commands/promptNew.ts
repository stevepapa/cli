import type { StorageOptions } from '../../node/storage/storage.js';
import { loadPrompt, promptExists, savePrompt } from '../../node/storage/storage.js';
import type { Prompt } from '../../core/types/index.js';
import { status } from '../cliKit.js';
import { RuntimeError, UsageError, ValidationError } from '../errors.js';
import { toErrorMessage } from '../../core/lib/errors.js';
import { PROMPT_SCHEMA_VERSION, X_PROMPTG_TIME } from '../../core/spec.js';
import { isKebabCaseName } from '../../core/lib/names.js';
import { editInEditor, stripHashCommentLines, writeTempFile } from './shared/editor.js';

function validatePromptName(name: string): string | null {
  if (!isKebabCaseName(name)) {
    return 'Invalid prompt name. Use kebab-case (lowercase with hyphens).';
  }
  return null;
}

export async function executePromptNew(
  name: string,
  store?: StorageOptions,
  options?: { force?: boolean; quiet?: boolean }
): Promise<void> {
  const quiet = options?.quiet === true;
  const force = options?.force === true;
  const log = (msg: string) => {
    if (!quiet) status(msg);
  };

  const validationError = validatePromptName(name);
  if (validationError) throw new UsageError(validationError);

  const exists = await promptExists(name, store);
  let existingCreatedAt: string | undefined;
  let initial = '# Enter prompt content. Lines starting with # are ignored.\n\n';

  if (exists) {
    if (!force)
      throw new ValidationError(`Prompt "${name}" already exists. Use --force to overwrite.`);
    const existing = await loadPrompt(name, store);
    existingCreatedAt = existing[X_PROMPTG_TIME]?.createdAt;
    initial = existing.content;
    log(`Overwriting existing prompt "${name}".`);
  }

  const edited =
    (await editInEditor({
      initial,
      filenameHint: name,
    })) ?? null;

  if (edited === null) throw new RuntimeError('Editor not available or failed to launch.');

  const content = stripHashCommentLines(edited);
  if (content.trim().length === 0) {
    const tempPath = await writeTempFile({
      prefix: 'promptg-prompt',
      filenameHint: name,
      ext: '.txt',
      content: edited,
    });
    throw new ValidationError('Prompt content cannot be empty.', {
      hints: [`Your edit was saved to: ${tempPath}`],
    });
  }

  const createdAt = existingCreatedAt ?? new Date().toISOString();
  const prompt: Prompt = {
    kind: 'prompt',
    schemaVersion: PROMPT_SCHEMA_VERSION,
    name,
    displayName: name,
    content,
    [X_PROMPTG_TIME]: { createdAt },
  };

  try {
    await savePrompt(prompt, store);
  } catch (e) {
    throw new RuntimeError(`Failed to save prompt: ${toErrorMessage(e)}`);
  }

  log(`Saved prompt "${name}".`);
}
