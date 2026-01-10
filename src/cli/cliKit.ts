import { Help } from 'commander';
import chalk, { Chalk as ChalkCtor } from 'chalk';
import {
  findNearestProjectStoreDir,
  getProjectStoreDirOrThrow,
} from '../node/storage/projectStore.js';
import type { StorageOptions } from '../node/storage/storage.js';
import { UsageError } from './errors.js';
import { promises as fs } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export type StoreMode = 'auto' | 'project' | 'global';

const MAX_VAR_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function isColorEnabled(stream: NodeJS.WriteStream): boolean {
  if (!stream.isTTY) return false;
  if (process.env.NO_COLOR) return false;
  return true;
}

export function getChalk(stream: NodeJS.WriteStream): typeof chalk {
  if (isColorEnabled(stream)) return chalk;
  return new ChalkCtor({ level: 0 });
}

export function fail(message: string): never {
  throw new UsageError(message);
}

export function warn(message: string): void {
  process.stderr.write(`warning: ${message}\n`);
}

export function status(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function isTty(): boolean {
  return !!process.stderr.isTTY && !!process.stdin.isTTY;
}

export function helpWrap(lines: string[], helper: Help): string {
  const helpWidth = helper.helpWidth ?? 80;
  return helper.wrap(lines.join('\n'), helpWidth, 0);
}

export async function resolveStoreFromOptions(
  options: Record<string, unknown>,
  cwd = process.cwd()
): Promise<{
  mode: StoreMode;
  store?: StorageOptions;
  projectRoot?: string | null;
}> {
  const storeOpt = typeof options.store === 'string' ? options.store : 'auto';
  const mode = storeOpt === 'project' || storeOpt === 'global' ? (storeOpt as StoreMode) : 'auto';

  if (mode === 'project') {
    const rootDir = await getProjectStoreDirOrThrow(cwd);
    return { mode: 'project', store: { rootDir }, projectRoot: rootDir };
  }

  if (mode === 'global') {
    return { mode: 'global', store: undefined, projectRoot: null };
  }

  const projectRoot = await findNearestProjectStoreDir(cwd);
  if (projectRoot) {
    return { mode: 'auto', store: { rootDir: projectRoot }, projectRoot };
  }

  return { mode: 'auto', store: undefined, projectRoot: null };
}

async function parseAssignment(input: string): Promise<{ key: string; value: string } | null> {
  const trimmed = input.trim();
  return parseKeyValueAssignment(trimmed) ?? (await parseKeyFileAssignment(trimmed));
}

function parseKeyValueAssignment(trimmed: string): { key: string; value: string } | null {
  const idx = trimmed.indexOf('=');
  if (idx <= 0) return null;
  const key = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + 1);
  if (!key) return null;
  return { key, value };
}

async function parseKeyFileAssignment(
  trimmed: string
): Promise<{ key: string; value: string } | null> {
  const at = trimmed.indexOf('@');
  if (at <= 0) return null;

  const key = trimmed.slice(0, at).trim();
  const file = trimmed.slice(at + 1).trim();
  if (!key || !file) return null;

  const filePath = resolve(process.cwd(), file);

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(filePath);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: unknown }).code === 'ENOENT'
    ) {
      fail(`Invalid --var "${trimmed}". File not found: ${file}`);
    }
    fail(`Invalid --var "${trimmed}". Could not read file metadata: ${file}`);
  }

  if (!stat.isFile()) {
    fail(`Invalid --var "${trimmed}". Not a file: ${file}`);
  }

  const size = typeof stat.size === 'bigint' ? Number(stat.size) : stat.size;
  return {
    key,
    value: await readVarFileValue({
      originalArg: trimmed,
      displayPath: file,
      resolvedPath: filePath,
      size,
    }),
  };
}

async function readVarFileValue(params: {
  originalArg: string;
  displayPath: string;
  resolvedPath: string;
  size: number;
}): Promise<string> {
  let cwdReal = '';
  let fileReal = '';
  try {
    cwdReal = await fs.realpath(process.cwd());
    fileReal = await fs.realpath(params.resolvedPath);
  } catch {
    fail(
      `Invalid --var "${params.originalArg}". Could not resolve real path for: ${params.displayPath}`
    );
  }
  const rel = relative(cwdReal, fileReal);
  const isOutsideCwd = rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  if (isOutsideCwd) {
    fail(
      `Invalid --var "${params.originalArg}". File path must be within current directory: ${params.displayPath}`
    );
  }

  if (params.size > MAX_VAR_FILE_SIZE_BYTES) {
    fail(`File too large: ${params.displayPath} (${params.size} bytes). Maximum 10485760 allowed.`);
  }

  try {
    return await fs.readFile(params.resolvedPath, 'utf8');
  } catch {
    fail(`Invalid --var "${params.originalArg}". Could not read file: ${params.displayPath}`);
  }
}

export async function parseVarAssignments(raw: unknown): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const items =
    typeof raw === 'string'
      ? [raw]
      : Array.isArray(raw)
        ? raw.filter(v => typeof v === 'string')
        : [];

  for (const item of items as string[]) {
    const parsed = await parseAssignment(item);
    if (!parsed) {
      fail(`Invalid --var value "${item}". Expected key=value or key@filepath.`);
    }
    out[`var:${parsed.key}`] = parsed.value;
  }

  return out;
}
