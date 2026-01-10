import type { StorageOptions } from '../../node/storage/storage.js';
import { deletePrompt, loadPrompt, promptExists, savePrompt } from '../../node/storage/storage.js';
import { status } from '../cliKit.js';
import { UsageError, ValidationError } from '../errors.js';
import { isKebabCaseName } from '../../core/lib/names.js';

function validatePromptName(name: string): string | null {
  if (!isKebabCaseName(name)) {
    return 'Invalid prompt name. Use kebab-case (lowercase with hyphens).';
  }
  return null;
}

export async function executePromptRename(
  oldName: string,
  newName: string,
  store: StorageOptions | undefined,
  options?: { force?: boolean; quiet?: boolean }
): Promise<void> {
  const quiet = options?.quiet === true;
  const force = options?.force === true;
  const log = (msg: string) => {
    if (!quiet) status(msg);
  };

  const oldErr = validatePromptName(oldName);
  if (oldErr) throw new UsageError(oldErr);
  const newErr = validatePromptName(newName);
  if (newErr) throw new UsageError(newErr);
  if (oldName === newName) {
    throw new UsageError('Old name and new name must be different.');
  }

  const oldExists = await promptExists(oldName, store);
  if (!oldExists) throw new ValidationError(`Prompt "${oldName}" not found.`);

  const newExists = await promptExists(newName, store);
  if (newExists && !force) {
    throw new ValidationError(`Prompt "${newName}" already exists. Use --force to overwrite.`);
  }

  const existing = await loadPrompt(oldName, store);
  const displayName =
    !existing.displayName || existing.displayName === oldName ? newName : existing.displayName;

  const renamed = { ...existing, name: newName, displayName };

  await savePrompt(renamed, store);
  await deletePrompt(oldName, store);

  log(`Renamed prompt "${oldName}" -> "${newName}".`);
}
