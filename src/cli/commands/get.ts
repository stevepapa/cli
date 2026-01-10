/**
 * Get Command - Retrieve prompts with variable substitution
 */

import { loadPrompt, promptExists, type StorageOptions } from '../../node/storage/storage.js';
import { templateExists, templateExistsInStore } from '../../node/storage/templates.js';
import { isStorageNotFoundError } from '../../node/storage/errors.js';
import type { Prompt } from '../../core/types/index.js';
import { ValidationError } from '../errors.js';
import type { CliServices } from '../services.js';
import { executeGetLikeRender, type StoreHintPolicy } from './shared/renderPipeline.js';

/**
 * Execute the get command
 */
export async function executeGet(
  services: CliServices,
  name: string,
  options: Record<string, unknown>,
  store?: StorageOptions,
  storeHints?: StoreHintPolicy
): Promise<void> {
  // Prompts are the only renderable/executable artifacts.
  let content = '';
  let sourceData: unknown = undefined;
  let loadedPrompt: Prompt | undefined;
  let resolvedSource: 'project' | 'global' = store?.rootDir ? 'project' : 'global';

  try {
    const prompt = await loadPrompt(name, store);
    content = prompt.content;
    sourceData = prompt;
    loadedPrompt = prompt;
  } catch (error) {
    // Only treat missing prompt as a "not found" condition. Other errors (e.g. corrupt JSON) should surface.
    if (!isStorageNotFoundError(error, 'prompt')) {
      throw error;
    }

    // Not found in selected store; in auto mode, allow project -> global fallback so global prompts still work in repos.
    if (storeHints?.fallbackToGlobal === true && store?.rootDir) {
      try {
        const prompt = await loadPrompt(name, undefined);
        content = prompt.content;
        sourceData = prompt;
        loadedPrompt = prompt;
        resolvedSource = 'global';
      } catch {
        // fall through
      }
    }

    if (!loadedPrompt) {
      const templateInSelectedStore = await templateExistsInStore(name, store);
      const templateInGlobalStore = store?.rootDir ? await templateExists(name) : false;

      const hints: string[] = ['Try: promptg prompt list'];
      if (templateInSelectedStore) {
        hints.unshift(
          `A template named "${name}" exists in the ${resolvedSource} store. Try: promptg prompt new ${name} --from-template ${name}${resolvedSource === 'project' ? ' --store project' : ''}`
        );
      } else if (templateInGlobalStore) {
        hints.unshift(
          `A template named "${name}" exists in the global store. Try: promptg prompt new ${name} --from-template ${name} --store global`
        );
      }

      throw new ValidationError(`Prompt "${name}" not found.`, { hints });
    }
  }

  const quiet = options.quiet === true;
  const format = options.format === 'json' ? 'json' : 'text';

  if (
    !quiet &&
    format !== 'json' &&
    storeHints?.warnOnShadow === true &&
    storeHints.mode === 'auto' &&
    resolvedSource === 'project' &&
    store?.rootDir
  ) {
    const globalPromptAlsoExists = await promptExists(name, undefined);
    if (globalPromptAlsoExists) {
      process.stderr.write(
        `warning: project "${name}" overrides a global prompt with the same name. Use --store global to force the global version.\n`
      );
    }
  }

  const title = loadedPrompt?.displayName ?? loadedPrompt?.name ?? name;
  await executeGetLikeRender({
    services,
    kind: 'prompt',
    name,
    sourceLabel: 'saved prompt',
    content,
    sourceData,
    title,
    descriptionText: loadedPrompt?.description,
    tags: loadedPrompt?.tags,
    resolvedSource,
    store,
    storeHints,
    options: { ...options, format, quiet },
  });
}
