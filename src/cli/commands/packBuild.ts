import { buildPromptPack } from '../../node/packs/pack.js';
import type { StorageOptions } from '../../node/storage/storage.js';
import { status } from '../cliKit.js';
import { UsageError } from '../errors.js';

export async function executePackBuild(
  name: string,
  options: Record<string, unknown>,
  store?: StorageOptions
): Promise<{
  action: 'pack.build';
  pack: { name: string; version: string; description?: string | null };
  filePath: string;
  templateCount: number;
  promptCount: number;
}> {
  const version = typeof options.packVersion === 'string' ? options.packVersion : '';
  const force = options.force === true;
  const quiet = options.quiet === true;

  if (!version) {
    throw new UsageError('Missing required option: --pack-version <semver>');
  }

  const res = await buildPromptPack({ name, version, store, force });
  const promptCount = Array.isArray(res.pack.prompts) ? res.pack.prompts.length : 0;
  const templateCount = Array.isArray(res.pack.templates) ? res.pack.templates.length : 0;

  if (!quiet) {
    status(`Built pack ${res.pack.name}@${res.pack.version}`);
    status(`Path: ${res.filePath}`);
    if (!res.pack.description) {
      status('Warning: pack has no description (recommended for public distribution).');
    }
    status(`Templates: ${templateCount}`);
    status(`Prompts:   ${promptCount}`);
  }

  return {
    action: 'pack.build',
    pack: {
      name: res.pack.name,
      version: res.pack.version,
      description: res.pack.description ?? null,
    },
    filePath: res.filePath,
    templateCount,
    promptCount,
  };
}
