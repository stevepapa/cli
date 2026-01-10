/**
 * Import Command - Import a prompt or template from JSON (file path or URL)
 */

import type { StorageOptions } from '../../node/storage/storage.js';
import { importFromSource } from '../../node/importing/importer.js';
import { status } from '../cliKit.js';
import { UsageError } from '../errors.js';

export async function executeImport(
  source: string,
  options: Record<string, unknown>,
  store?: StorageOptions
): Promise<{ action: 'import'; kind: 'prompt' | 'template'; name: string; source: string }> {
  const force = options.force === true;
  const asFile = options.file === true;
  const asUrl = options.url === true;
  const quiet = options.quiet === true;

  if (asFile && asUrl) {
    throw new UsageError('Cannot combine --file and --url.');
  }

  const res = await importFromSource({
    source,
    store,
    force,
    asFile,
    asUrl,
  });
  const noun = res.kind === 'template' ? 'template' : 'prompt';
  if (!quiet) status(`Imported ${noun} "${res.name}".`);
  return { action: 'import', kind: res.kind, name: res.name, source };
}
