import type { StorageOptions } from '../../node/storage/storage.js';
import { loadTemplate, loadTemplateFromStore } from '../../node/storage/templates.js';
import { isStorageNotFoundError } from '../../node/storage/errors.js';
import type { Template } from '../../core/types/index.js';
import { PROMPT_SCHEMA_URL, TEMPLATE_SCHEMA_URL } from '../../core/spec.js';
import { ValidationError } from '../errors.js';
import { writeJsonSuccess } from '../output.js';

type ResolvedSource = 'project' | 'global';

async function loadTemplateWithFallback(params: {
  name: string;
  store?: StorageOptions;
  mode: 'auto' | 'project' | 'global';
}): Promise<{ template: Template; resolvedSource: ResolvedSource }> {
  const resolvedSource: ResolvedSource = params.store?.rootDir ? 'project' : 'global';

  try {
    const template = params.store?.rootDir
      ? await loadTemplateFromStore(params.name, params.store)
      : await loadTemplate(params.name);
    return { template, resolvedSource };
  } catch (error) {
    if (!isStorageNotFoundError(error, 'template')) throw error;
  }

  if (params.mode === 'auto' && params.store?.rootDir) {
    try {
      const template = await loadTemplate(params.name);
      return { template, resolvedSource: 'global' };
    } catch (error) {
      if (!isStorageNotFoundError(error, 'template')) throw error;
    }
  }

  throw new ValidationError(`Template "${params.name}" not found.`, {
    hints: ['Try: promptg template list'],
  });
}

export async function executeTemplateShow(params: {
  name: string;
  embedded: boolean;
  store?: StorageOptions;
  mode: 'auto' | 'project' | 'global';
  format: 'text' | 'json';
}): Promise<void> {
  const { template, resolvedSource } = await loadTemplateWithFallback({
    name: params.name,
    store: params.store,
    mode: params.mode,
  });

  if (params.embedded) {
    const promptOut = { $schema: PROMPT_SCHEMA_URL, ...template.prompt };
    if (params.format === 'json') {
      writeJsonSuccess({ prompt: promptOut, source: { store: resolvedSource } });
      return;
    }
    process.stdout.write(`${JSON.stringify(promptOut, null, 2)}\n`);
    return;
  }

  const templateOut = {
    $schema: TEMPLATE_SCHEMA_URL,
    ...template,
    prompt: { $schema: PROMPT_SCHEMA_URL, ...template.prompt },
  };

  if (params.format === 'json') {
    writeJsonSuccess({ template: templateOut, source: { store: resolvedSource } });
    return;
  }

  process.stdout.write(`${JSON.stringify(templateOut, null, 2)}\n`);
}
