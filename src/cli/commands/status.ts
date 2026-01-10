/**
 * Status Command - Show current PromptG context and storage state
 */

import { promises as fs } from 'node:fs';
import { findNearestProjectStoreDir } from '../../node/storage/projectStore.js';
import {
  getPacksDir,
  getStorageDir,
  getStorageStats,
  type StorageOptions,
} from '../../node/storage/storage.js';
import { version } from '../version.js';
import { writeJsonSuccess } from '../output.js';
import { PACK_FILE_PREFIX } from '../../core/spec.js';

type StatusJson = {
  version: string;
  cwd: string;
  projectStore: { root: string | null; prompts: number; templates: number; packs: number } | null;
  globalStore: { root: string; prompts: number; templates: number; packs: number };
  conventions: {
    promptFile: string;
    templateFile: string;
    packFile: string;
  };
};

async function countPacks(opts?: StorageOptions): Promise<number> {
  const dir = getPacksDir(opts);
  try {
    const files = await fs.readdir(dir);
    return files.filter(f => f.startsWith(PACK_FILE_PREFIX) && f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

export async function executeStatus(options?: {
  format?: 'text' | 'json';
  cwd?: string;
}): Promise<void> {
  const cwd = options?.cwd ?? process.cwd();
  const format = options?.format === 'json' ? 'json' : 'text';

  const projectRoot = await findNearestProjectStoreDir(cwd);
  const projectStore = projectRoot
    ? ({ rootDir: projectRoot } satisfies StorageOptions)
    : undefined;

  const [globalStats, globalPacks, projectStats, projectPacks] = await Promise.all([
    getStorageStats(),
    countPacks(),
    projectStore ? getStorageStats(projectStore) : Promise.resolve(null),
    projectStore ? countPacks(projectStore) : Promise.resolve(null),
  ]);

  const json: StatusJson = {
    version,
    cwd,
    globalStore: {
      root: getStorageDir(),
      prompts: globalStats.promptCount,
      templates: globalStats.templateCount,
      packs: globalPacks,
    },
    projectStore: projectStore
      ? {
          root: projectRoot,
          prompts: projectStats?.promptCount ?? 0,
          templates: projectStats?.templateCount ?? 0,
          packs: projectPacks ?? 0,
        }
      : null,
    conventions: {
      promptFile: 'promptg-prompt-<name>.json',
      templateFile: 'promptg-template-<name>.json',
      packFile: 'promptg-pack-<name>.json',
    },
  };

  if (format === 'json') {
    writeJsonSuccess(json);
    return;
  }

  process.stdout.write(`promptg v${version}\n`);
  process.stdout.write(`cwd: ${cwd}\n\n`);

  if (json.projectStore) {
    process.stdout.write(`project: ${json.projectStore.root}\n`);
    process.stdout.write(
      `  prompts: ${json.projectStore.prompts}  templates: ${json.projectStore.templates}  packs: ${json.projectStore.packs}\n\n`
    );
  }

  process.stdout.write(`global:  ${json.globalStore.root}\n`);
  process.stdout.write(
    `  prompts: ${json.globalStore.prompts}  templates: ${json.globalStore.templates}  packs: ${json.globalStore.packs}\n\n`
  );

  process.stdout.write('conventions:\n');
  process.stdout.write(`  prompts:   ${json.conventions.promptFile}\n`);
  process.stdout.write(`  templates: ${json.conventions.templateFile}\n`);
  process.stdout.write(`  packs:     ${json.conventions.packFile}\n`);
}
