import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { StorageOptions } from '../../node/storage/storage.js';
import {
  getPacksDir,
  getPromptsDir,
  getTemplatesDir,
  initializeDirectories,
} from '../../node/storage/storage.js';
import {
  normalizeImportedPrompt,
  normalizeImportedTemplate,
} from '../../core/importing/normalize.js';
import { normalizePromptPack } from '../../core/packs/pack.js';
import { status } from '../cliKit.js';
import { ValidationError } from '../errors.js';
import { writeJsonSuccess } from '../output.js';
import { getNodeErrorCode, toErrorMessage } from '../../core/lib/errors.js';
import {
  PACK_FILE_PREFIX,
  PROMPT_FILE_PREFIX,
  PROMPT_SCHEMA_VERSION,
  TEMPLATE_FILE_PREFIX,
  TEMPLATE_SCHEMA_VERSION,
} from '../../core/spec.js';

type Issue = { kind: 'prompt' | 'template' | 'pack'; filePath: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validatePromptV1Shape(data: unknown): string | null {
  if (!isRecord(data)) return 'JSON must be an object';
  if (data.kind !== 'prompt') return 'Missing or invalid field: kind (expected "prompt")';
  if (data.schemaVersion !== PROMPT_SCHEMA_VERSION)
    return `Missing or invalid field: schemaVersion (expected "${PROMPT_SCHEMA_VERSION}")`;
  return null;
}

function validateTemplateV1Shape(data: unknown): string | null {
  if (!isRecord(data)) return 'JSON must be an object';
  if (data.kind !== 'template') return 'Missing or invalid field: kind (expected "template")';
  if (data.schemaVersion !== TEMPLATE_SCHEMA_VERSION)
    return `Missing or invalid field: schemaVersion (expected "${TEMPLATE_SCHEMA_VERSION}")`;
  return null;
}

async function readJson(filePath: string): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const items = await fs.readdir(dir);
    return items.filter(n => n.endsWith('.json')).map(n => path.join(dir, n));
  } catch (e) {
    if (getNodeErrorCode(e) === 'ENOENT') return [];
    throw e;
  }
}

export async function executeValidate(
  store?: StorageOptions,
  options?: { format?: 'text' | 'json'; quiet?: boolean }
): Promise<void> {
  const issues: Issue[] = [];
  const format = options?.format === 'json' ? 'json' : 'text';
  const quiet = options?.quiet === true;

  await initializeDirectories(store);

  const [promptFiles, templateFiles, packFiles] = await Promise.all([
    listJsonFiles(getPromptsDir(store)),
    listJsonFiles(getTemplatesDir(store)),
    listJsonFiles(getPacksDir(store)),
  ]);

  for (const filePath of promptFiles) {
    const base = path.basename(filePath);
    if (!base.startsWith(PROMPT_FILE_PREFIX)) continue;
    try {
      const data = await readJson(filePath);
      const shapeError = validatePromptV1Shape(data);
      if (shapeError) {
        issues.push({ kind: 'prompt', filePath, message: shapeError });
        continue;
      }
      const normalized = normalizeImportedPrompt(data);
      if (!normalized.ok) {
        issues.push({ kind: 'prompt', filePath, message: normalized.error });
      }
    } catch (e) {
      issues.push({ kind: 'prompt', filePath, message: toErrorMessage(e) });
    }
  }

  for (const filePath of templateFiles) {
    const base = path.basename(filePath);
    if (!base.startsWith(TEMPLATE_FILE_PREFIX)) continue;
    try {
      const data = await readJson(filePath);
      const shapeError = validateTemplateV1Shape(data);
      if (shapeError) {
        issues.push({ kind: 'template', filePath, message: shapeError });
        continue;
      }
      const normalized = normalizeImportedTemplate(data);
      if (!normalized.ok) {
        issues.push({ kind: 'template', filePath, message: normalized.error });
      }
    } catch (e) {
      issues.push({ kind: 'template', filePath, message: toErrorMessage(e) });
    }
  }

  for (const filePath of packFiles) {
    const base = path.basename(filePath);
    if (!base.startsWith(PACK_FILE_PREFIX)) continue;
    try {
      const data = await readJson(filePath);
      const normalized = normalizePromptPack(data);
      if (!normalized.ok) {
        issues.push({ kind: 'pack', filePath, message: normalized.error });
      }
    } catch (e) {
      issues.push({ kind: 'pack', filePath, message: toErrorMessage(e) });
    }
  }

  if (format === 'json') {
    if (issues.length === 0) {
      writeJsonSuccess({ issues: [] });
      return;
    }
    throw new ValidationError('validation failed', { issues });
  }

  if (issues.length === 0) {
    if (!quiet) status('Validated: no issues found.');
    return;
  }

  throw new ValidationError(
    `validation failed (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    { issues }
  );
}
