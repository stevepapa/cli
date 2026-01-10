/**
 * Doctor Command - Diagnostics for common environment/store issues.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { findNearestProjectStoreDir } from '../../node/storage/projectStore.js';
import type { StorageOptions } from '../../node/storage/storage.js';
import { getStorageDir } from '../../node/storage/storage.js';
import { parsePromptJsonText } from '../../core/parsing/prompt.js';
import { parseTemplateJsonText } from '../../core/parsing/template.js';
import { getNodeErrorCode, toErrorMessage } from '../../core/lib/errors.js';
import { version } from '../version.js';
import { writeTextFileAtomic } from '../../node/fs/writeAtomic.js';
import { PACK_FILE_PREFIX, PROMPT_FILE_PREFIX, TEMPLATE_FILE_PREFIX } from '../../core/spec.js';
import { writeJsonSuccess } from '../output.js';

type CheckResult = { ok: true } | { ok: false; error: string; code?: string };

type DirHealth = {
  path: string;
  exists: boolean;
  readable: CheckResult;
  writable: CheckResult;
};

type StoreHealth = {
  scope: 'global' | 'project';
  rootDir: string;
  promptsDir: DirHealth & { prompts: number; invalidPromptFiles: number };
  templatesDir: DirHealth & { templates: number; invalidTemplateFiles: number };
  packsDir: DirHealth & { packs: number };
};

type DoctorJson = {
  version: string;
  node: { version: string; platform: NodeJS.Platform; arch: string };
  cwd: string;
  tty: { stdin: boolean; stdout: boolean; stderr: boolean };
  storeSelection: {
    requestedMode: 'auto' | 'project' | 'global';
    resolvedScope: 'global' | 'project';
    resolvedRootDir: string;
    nearestProjectRoot: string | null;
  };
  stores: {
    global: StoreHealth;
    project: StoreHealth | null;
  };
  hints: string[];
};

function ok(): CheckResult {
  return { ok: true };
}

function err(error: unknown): CheckResult {
  return { ok: false, error: toErrorMessage(error), code: getNodeErrorCode(error) ?? undefined };
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function checkReadableDir(dirPath: string): Promise<CheckResult> {
  try {
    await fs.readdir(dirPath);
    return ok();
  } catch (e) {
    return err(e);
  }
}

async function checkWritableDir(dirPath: string): Promise<CheckResult> {
  const exists = await dirExists(dirPath);
  if (!exists) {
    return { ok: false, error: 'Directory does not exist', code: 'ENOENT' };
  }

  const filePath = path.join(dirPath, `.promptg-doctor-${process.pid}-${randomUUID()}.tmp`);
  try {
    await writeTextFileAtomic(filePath, 'promptg doctor\n', 'utf8');
    await fs.unlink(filePath);
    return ok();
  } catch (e) {
    await fs.unlink(filePath).catch(() => {});
    return err(e);
  }
}

async function scanPrompts(promptsDir: string): Promise<{ count: number; invalid: number }> {
  try {
    const files = await fs.readdir(promptsDir);
    const jsonFiles = files.filter(f => f.startsWith(PROMPT_FILE_PREFIX) && f.endsWith('.json'));

    let count = 0;
    let invalid = 0;
    for (const file of jsonFiles) {
      try {
        const text = await fs.readFile(path.join(promptsDir, file), 'utf8');
        const parsed = parsePromptJsonText(text);
        if (!parsed.ok) {
          invalid += 1;
          continue;
        }
        count += 1;
      } catch {
        invalid += 1;
      }
    }

    return { count, invalid };
  } catch (e) {
    if (getNodeErrorCode(e) === 'ENOENT') return { count: 0, invalid: 0 };
    throw e;
  }
}

async function scanTemplates(templatesDir: string): Promise<{ count: number; invalid: number }> {
  try {
    const files = await fs.readdir(templatesDir);
    const jsonFiles = files.filter(f => f.startsWith(TEMPLATE_FILE_PREFIX) && f.endsWith('.json'));

    let count = 0;
    let invalid = 0;
    for (const file of jsonFiles) {
      try {
        const text = await fs.readFile(path.join(templatesDir, file), 'utf8');
        const parsed = parseTemplateJsonText(text);
        if (!parsed.ok) {
          invalid += 1;
          continue;
        }
        count += 1;
      } catch {
        invalid += 1;
      }
    }

    return { count, invalid };
  } catch (e) {
    if (getNodeErrorCode(e) === 'ENOENT') return { count: 0, invalid: 0 };
    throw e;
  }
}

async function countPacks(packsDir: string): Promise<number> {
  try {
    const files = await fs.readdir(packsDir);
    return files.filter(f => f.startsWith(PACK_FILE_PREFIX) && f.endsWith('.json')).length;
  } catch (e) {
    if (getNodeErrorCode(e) === 'ENOENT') return 0;
    throw e;
  }
}

async function inspectStore(
  scope: 'global' | 'project',
  opts?: StorageOptions
): Promise<StoreHealth> {
  const rootDir = getStorageDir(opts);
  const promptsDir = path.join(rootDir, 'prompts');
  const templatesDir = path.join(rootDir, 'templates');
  const packsDir = path.join(rootDir, 'packs');

  const [promptsExists, templatesExists, packsExists] = await Promise.all([
    dirExists(promptsDir),
    dirExists(templatesDir),
    dirExists(packsDir),
  ]);

  const [promptsReadable, templatesReadable, packsReadable] = await Promise.all([
    promptsExists
      ? checkReadableDir(promptsDir)
      : { ok: false, error: 'Directory does not exist', code: 'ENOENT' },
    templatesExists
      ? checkReadableDir(templatesDir)
      : { ok: false, error: 'Directory does not exist', code: 'ENOENT' },
    packsExists
      ? checkReadableDir(packsDir)
      : { ok: false, error: 'Directory does not exist', code: 'ENOENT' },
  ]);

  const [promptsWritable, templatesWritable, packsWritable] = await Promise.all([
    checkWritableDir(promptsDir),
    checkWritableDir(templatesDir),
    checkWritableDir(packsDir),
  ]);

  let promptCounts = { count: 0, invalid: 0 };
  let templateCounts = { count: 0, invalid: 0 };
  let packCount = 0;

  try {
    if (promptsReadable.ok) promptCounts = await scanPrompts(promptsDir);
  } catch {
    // Keep readable error as the surface; scanning is best-effort.
  }

  try {
    if (templatesReadable.ok) templateCounts = await scanTemplates(templatesDir);
  } catch {
    // best-effort
  }

  try {
    if (packsReadable.ok) packCount = await countPacks(packsDir);
  } catch {
    // best-effort
  }

  return {
    scope,
    rootDir,
    promptsDir: {
      path: promptsDir,
      exists: promptsExists,
      readable: promptsReadable,
      writable: promptsWritable,
      prompts: promptCounts.count,
      invalidPromptFiles: promptCounts.invalid,
    },
    templatesDir: {
      path: templatesDir,
      exists: templatesExists,
      readable: templatesReadable,
      writable: templatesWritable,
      templates: templateCounts.count,
      invalidTemplateFiles: templateCounts.invalid,
    },
    packsDir: {
      path: packsDir,
      exists: packsExists,
      readable: packsReadable,
      writable: packsWritable,
      packs: packCount,
    },
  };
}

function formatCheck(check: CheckResult): string {
  if (check.ok) return 'ok';
  const suffix = check.code ? ` (${check.code})` : '';
  return `error${suffix}`;
}

export async function executeDoctor(params: {
  requestedMode: 'auto' | 'project' | 'global';
  selectedStore?: StorageOptions;
  cwd?: string;
  format?: 'text' | 'json';
}): Promise<void> {
  const cwd = params.cwd ?? process.cwd();
  const format = params.format === 'json' ? 'json' : 'text';

  const nearestProjectRoot = await findNearestProjectStoreDir(cwd);
  const resolvedScope: 'global' | 'project' = params.selectedStore?.rootDir ? 'project' : 'global';
  const resolvedRootDir = getStorageDir(params.selectedStore);

  const [globalHealth, projectHealth] = await Promise.all([
    inspectStore('global', undefined),
    nearestProjectRoot
      ? inspectStore('project', { rootDir: nearestProjectRoot })
      : Promise.resolve(null),
  ]);

  const hints: string[] = [];

  const invalidPrompts =
    resolvedScope === 'global'
      ? globalHealth.promptsDir.invalidPromptFiles
      : (projectHealth?.promptsDir.invalidPromptFiles ?? 0);
  const invalidTemplates =
    resolvedScope === 'global'
      ? globalHealth.templatesDir.invalidTemplateFiles
      : (projectHealth?.templatesDir.invalidTemplateFiles ?? 0);

  if (invalidPrompts > 0 || invalidTemplates > 0) {
    const parts = [
      invalidPrompts > 0
        ? `${invalidPrompts} invalid prompt file${invalidPrompts === 1 ? '' : 's'}`
        : null,
      invalidTemplates > 0
        ? `${invalidTemplates} invalid template file${invalidTemplates === 1 ? '' : 's'}`
        : null,
    ].filter(Boolean);
    hints.push(`Ignored ${parts.join(' and ')}; run: promptg validate`);
  }

  const json: DoctorJson = {
    version,
    node: { version: process.version, platform: process.platform, arch: process.arch },
    cwd,
    tty: {
      stdin: !!process.stdin.isTTY,
      stdout: !!process.stdout.isTTY,
      stderr: !!process.stderr.isTTY,
    },
    storeSelection: {
      requestedMode: params.requestedMode,
      resolvedScope,
      resolvedRootDir,
      nearestProjectRoot,
    },
    stores: {
      global: globalHealth,
      project: projectHealth,
    },
    hints,
  };

  if (format === 'json') {
    writeJsonSuccess(json);
    return;
  }

  process.stdout.write(`promptg doctor\n`);
  process.stdout.write(`promptg v${version}\n`);
  process.stdout.write(`node: ${process.version} (${process.platform} ${process.arch})\n`);
  process.stdout.write(`cwd: ${cwd}\n\n`);

  process.stdout.write('tty:\n');
  process.stdout.write(
    `  stdin: ${json.tty.stdin ? 'yes' : 'no'}  stdout: ${json.tty.stdout ? 'yes' : 'no'}  stderr: ${json.tty.stderr ? 'yes' : 'no'}\n\n`
  );

  process.stdout.write('store selection:\n');
  process.stdout.write(
    `  requested: ${json.storeSelection.requestedMode}  resolved: ${json.storeSelection.resolvedScope}\n`
  );
  process.stdout.write(`  resolved root: ${json.storeSelection.resolvedRootDir}\n`);
  if (json.storeSelection.nearestProjectRoot) {
    process.stdout.write(`  nearest project: ${json.storeSelection.nearestProjectRoot}\n`);
  }
  process.stdout.write('\n');

  const renderStore = (store: StoreHealth): void => {
    process.stdout.write(`${store.scope}: ${store.rootDir}\n`);

    process.stdout.write(
      `  prompts:   ${store.promptsDir.prompts} (${store.promptsDir.invalidPromptFiles} invalid)\n`
    );
    process.stdout.write(
      `    dir: ${store.promptsDir.path}\n    read: ${formatCheck(store.promptsDir.readable)}  write: ${formatCheck(store.promptsDir.writable)}\n`
    );

    process.stdout.write(
      `  templates: ${store.templatesDir.templates} (${store.templatesDir.invalidTemplateFiles} invalid)\n`
    );
    process.stdout.write(
      `    dir: ${store.templatesDir.path}\n    read: ${formatCheck(store.templatesDir.readable)}  write: ${formatCheck(store.templatesDir.writable)}\n`
    );

    process.stdout.write(`  packs:     ${store.packsDir.packs}\n`);
    process.stdout.write(
      `    dir: ${store.packsDir.path}\n    read: ${formatCheck(store.packsDir.readable)}  write: ${formatCheck(store.packsDir.writable)}\n`
    );
    process.stdout.write('\n');
  };

  renderStore(globalHealth);
  if (projectHealth) renderStore(projectHealth);

  if (hints.length > 0) {
    process.stdout.write('hints:\n');
    for (const h of hints) process.stdout.write(`  - ${h}\n`);
    process.stdout.write('\n');
  }
}
