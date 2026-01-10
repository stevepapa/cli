/**
 * Project Store Discovery - Finds a project-local `.promptg/` folder.
 *
 * Used by the CLI auto store mode and by explicit `--store project` mode.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { getStorageDir } from './storage.js';
import { InfraError } from '../../core/infra/errors.js';

export async function findNearestProjectStoreDir(
  startDir: string = process.cwd()
): Promise<string | null> {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;
  const globalStoreDir = path.resolve(getStorageDir());

  while (true) {
    const candidate = path.join(current, '.promptg');
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        const resolved = path.resolve(candidate);
        // Never treat the global ~/.promptg store as a project-local store.
        if (resolved !== globalStoreDir) return resolved;
      }
    } catch {
      // ignore
    }

    if (current === root) return null;
    current = path.dirname(current);
  }
}

export async function getProjectStoreDirOrThrow(startDir: string = process.cwd()): Promise<string> {
  const dir = await findNearestProjectStoreDir(startDir);
  if (!dir) {
    throw new InfraError({
      infraCode: 'NOT_FOUND',
      message: 'No .promptg folder found in this project tree. Try: promptg init',
      details: { startDir },
    });
  }
  return dir;
}
