import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { StorageOptions } from '../../src/node/storage/storage.js';

export type TempStore = {
  tmpDir: string;
  store: StorageOptions;
};

export async function makeTempStore(prefix = 'promptg-test-'): Promise<TempStore> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return { tmpDir, store: { rootDir: path.join(tmpDir, '.promptg') } };
}

export async function cleanupTempStore(tmpDir: string): Promise<void> {
  await fs.rm(tmpDir, { recursive: true, force: true });
}
