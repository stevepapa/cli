/**
 * Rm/Delete Command - Delete a saved prompt
 */

import {
  deletePrompt,
  promptExists,
  type StorageOptions,
  getStorageDir,
} from '../../node/storage/storage.js';
import { ValidationError } from '../errors.js';

export async function executeRm(
  name: string,
  store: StorageOptions | undefined,
  mode: 'auto' | 'project' | 'global',
  options?: { quiet?: boolean }
): Promise<void> {
  const quiet = options?.quiet === true;
  const exists = await promptExists(name, store);
  if (!exists) {
    const hints: string[] = [];
    if (store?.rootDir) {
      hints.push('A project store is selected.');
      const existsInGlobal = await promptExists(name, undefined);
      if (existsInGlobal) {
        hints.push(`A global prompt named "${name}" exists.`);
        hints.push(`Try: promptg prompt rm ${name} --store global`);
      } else {
        hints.push('Try: promptg prompt list');
      }
    } else {
      hints.push('Try: promptg prompt list');
    }
    throw new ValidationError(`Prompt "${name}" not found.`, { hints, mode });
  }

  await deletePrompt(name, store);

  const root = store?.rootDir ? store.rootDir : getStorageDir();
  if (!quiet) {
    process.stderr.write(`Removed prompt "${name}".\n`);
    process.stderr.write(`Store: ${root}\n`);
  }
}
