import {
  normalizePromptPack,
  readPackFromSource,
  installPromptPack,
} from '../../node/packs/pack.js';
import type { StorageOptions } from '../../node/storage/storage.js';
import { status } from '../cliKit.js';
import { UsageError, ValidationError } from '../errors.js';

export async function executePackInstall(
  source: string,
  options: Record<string, unknown>,
  store?: StorageOptions
): Promise<{
  action: 'pack.install';
  pack: { name: string; version: string };
  installedTemplates: string[];
  skippedTemplates: string[];
  installedPrompts: string[];
  skippedPrompts: string[];
}> {
  const force = options.force === true;
  const onlyNew = options.onlyNew === true;
  const quiet = options.quiet === true;

  if (force && onlyNew) {
    throw new UsageError('Cannot combine --force and --only-new.');
  }

  const raw = await readPackFromSource(source);
  const normalized = normalizePromptPack(raw);
  if (!normalized.ok) {
    throw new ValidationError(normalized.error);
  }

  const res = await installPromptPack({
    pack: normalized.value,
    store,
    force,
    onlyNew,
  });

  if (!quiet) {
    status(`Installed pack ${normalized.value.name}@${normalized.value.version}`);
    status(
      `Templates: installed=${res.installedTemplates.length} skipped=${res.skippedTemplates.length}`
    );
    status(
      `Prompts:   installed=${res.installedPrompts.length} skipped=${res.skippedPrompts.length}`
    );

    if (res.skippedTemplates.length > 0) {
      status(`Skipped templates: ${res.skippedTemplates.join(', ')}`);
    }
    if (res.skippedPrompts.length > 0) {
      status(`Skipped prompts: ${res.skippedPrompts.join(', ')}`);
    }
  }

  return {
    action: 'pack.install',
    pack: { name: normalized.value.name, version: normalized.value.version },
    installedTemplates: res.installedTemplates,
    skippedTemplates: res.skippedTemplates,
    installedPrompts: res.installedPrompts,
    skippedPrompts: res.skippedPrompts,
  };
}
