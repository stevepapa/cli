import type { StorageOptions } from '../../node/storage/storage.js';
import { loadPrompt } from '../../node/storage/storage.js';
import { isStorageNotFoundError } from '../../node/storage/errors.js';
import { PROMPT_SCHEMA_URL } from '../../core/spec.js';
import { ValidationError } from '../errors.js';
import { writeJsonSuccess } from '../output.js';

type ResolvedSource = 'project' | 'global';

export async function executePromptShow(params: {
  name: string;
  store?: StorageOptions;
  mode: 'auto' | 'project' | 'global';
  format: 'text' | 'json';
}): Promise<void> {
  let resolvedSource: ResolvedSource = params.store?.rootDir ? 'project' : 'global';

  try {
    const prompt = await loadPrompt(params.name, params.store);
    const out = { $schema: PROMPT_SCHEMA_URL, ...prompt };

    if (params.format === 'json') {
      writeJsonSuccess({ prompt: out, source: { store: resolvedSource } });
      return;
    }

    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    return;
  } catch (error) {
    if (!isStorageNotFoundError(error, 'prompt')) throw error;
  }

  // Auto-mode fallback: project -> global.
  if (params.mode === 'auto' && params.store?.rootDir) {
    try {
      const prompt = await loadPrompt(params.name, undefined);
      resolvedSource = 'global';
      const out = { $schema: PROMPT_SCHEMA_URL, ...prompt };

      if (params.format === 'json') {
        writeJsonSuccess({ prompt: out, source: { store: resolvedSource } });
        return;
      }

      process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
      return;
    } catch (error) {
      if (!isStorageNotFoundError(error, 'prompt')) throw error;
    }
  }

  throw new ValidationError(`Prompt "${params.name}" not found.`, {
    hints: ['Try: promptg prompt list'],
  });
}
