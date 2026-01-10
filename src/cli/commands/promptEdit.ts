import type { StorageOptions } from '../../node/storage/storage.js';
import { loadPrompt, savePrompt } from '../../node/storage/storage.js';
import type { Prompt } from '../../core/types/index.js';
import { parsePromptJsonText } from '../../core/parsing/prompt.js';
import { PROMPT_SCHEMA_URL, X_PROMPTG_TIME } from '../../core/spec.js';
import { status } from '../cliKit.js';
import { RuntimeError, ValidationError } from '../errors.js';
import { editInEditor, stripHashCommentLines, writeTempFile } from './shared/editor.js';

export async function executePromptEdit(
  name: string,
  store?: StorageOptions,
  options?: { quiet?: boolean; raw?: boolean }
): Promise<void> {
  const quiet = options?.quiet === true;
  const log = (msg: string) => {
    if (!quiet) status(msg);
  };

  const prompt = await loadPrompt(name, store);

  if (options?.raw === true) {
    const createdAt = prompt[X_PROMPTG_TIME]?.createdAt ?? new Date().toISOString();
    const initial = JSON.stringify({ $schema: PROMPT_SCHEMA_URL, ...prompt }, null, 2);

    const edited =
      (await editInEditor({
        initial,
        filenameHint: name,
      })) ?? null;

    if (edited === null) throw new RuntimeError('Editor not available or failed to launch.');

    const parsed = parsePromptJsonText(edited);
    if (!parsed.ok) {
      const tempPath = await writeTempFile({
        prefix: 'promptg-prompt',
        filenameHint: name,
        ext: '.json',
        content: edited,
      });
      throw new ValidationError(`Invalid prompt JSON: ${parsed.error}`, {
        hints: [`Your edit was saved to: ${tempPath}`],
      });
    }

    if (parsed.value.name !== name) {
      throw new ValidationError(
        'Cannot change prompt "name" in editor. Use `prompt rename` instead.'
      );
    }

    const normalized: Prompt = parsed.value[X_PROMPTG_TIME]?.createdAt
      ? parsed.value
      : { ...parsed.value, [X_PROMPTG_TIME]: { createdAt } };

    await savePrompt(normalized, store);
    log(`Saved prompt "${name}".`);
    return;
  }

  const edited =
    (await editInEditor({
      initial: prompt.content,
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

  const updated: Prompt = { ...prompt, content };
  await savePrompt(updated, store);
  log(`Saved prompt "${name}".`);
}
