import type { StorageOptions } from '../../node/storage/storage.js';
import { deleteTemplate, templateExistsInStore } from '../../node/storage/templates.js';
import { getStorageDir } from '../../node/storage/storage.js';
import { ValidationError } from '../errors.js';

export async function executeTemplateRm(
  name: string,
  store: StorageOptions | undefined,
  options?: { quiet?: boolean }
): Promise<void> {
  const quiet = options?.quiet === true;
  const exists = await templateExistsInStore(name, store);
  if (!exists) {
    throw new ValidationError(`Template "${name}" not found.`, {
      hints: ['Try: promptg template list'],
    });
  }

  await deleteTemplate(name, store);

  const root = store?.rootDir ? store.rootDir : getStorageDir();
  if (!quiet) {
    process.stderr.write(`Removed template "${name}".\n`);
    process.stderr.write(`Store: ${root}\n`);
  }
}
