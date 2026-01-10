/**
 * Storage Layer - Manages local file system for prompts and templates
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Prompt } from '../../core/types/index.js';
import { getNodeErrorCode, toErrorMessage } from '../../core/lib/errors.js';
import { parsePromptJsonText } from '../../core/parsing/prompt.js';
import { writeTextFileAtomic } from '../fs/writeAtomic.js';
import { InfraError } from '../../core/infra/errors.js';
import { StorageNotFoundError } from './errors.js';
import {
  PROMPT_FILE_PREFIX,
  PROMPT_SCHEMA_URL,
  PROMPT_SCHEMA_VERSION,
  TEMPLATE_FILE_PREFIX,
  X_PROMPTG_TIME,
} from '../../core/spec.js';

const PACKS_DIR_NAME = 'packs';

export type ListPromptsDiagnostics = { prompts: Prompt[]; invalidFiles: number };

type PromptCacheEntry = {
  promptsByName: Map<string, Prompt>;
  listPromise?: Promise<ListPromptsDiagnostics>;
};

const promptCacheByStoreDir = new Map<string, PromptCacheEntry>();

function getPromptCacheKey(opts?: StorageOptions): string {
  return getStorageDir(opts);
}

function getPromptCache(opts?: StorageOptions): PromptCacheEntry {
  const key = getPromptCacheKey(opts);
  const existing = promptCacheByStoreDir.get(key);
  if (existing) return existing;
  const next: PromptCacheEntry = { promptsByName: new Map<string, Prompt>() };
  promptCacheByStoreDir.set(key, next);
  return next;
}

function invalidatePromptCache(opts?: StorageOptions): void {
  const key = getPromptCacheKey(opts);
  promptCacheByStoreDir.delete(key);
}

export type StorageOptions = {
  /**
   * Overrides the storage root.
   * - Personal default: ~/.promptg
   * - Project store: <repo>/.promptg
   */
  rootDir?: string;
};

function promptFileName(name: string): string {
  return `${PROMPT_FILE_PREFIX}${name}.json`;
}

/**
 * Get the base storage directory
 * Returns: ~/.promptg/
 */
export function getStorageDir(opts?: StorageOptions): string {
  return opts?.rootDir ? path.resolve(opts.rootDir) : path.join(os.homedir(), '.promptg');
}

/**
 * Get the prompts directory
 * Returns: ~/.promptg/prompts/
 */
export function getPromptsDir(opts?: StorageOptions): string {
  return path.join(getStorageDir(opts), 'prompts');
}

/**
 * Get the templates directory
 * Returns: ~/.promptg/templates/
 */
export function getTemplatesDir(opts?: StorageOptions): string {
  return path.join(getStorageDir(opts), 'templates');
}

/**
 * Get the packs directory
 * Returns: ~/.promptg/packs/
 */
export function getPacksDir(opts?: StorageOptions): string {
  return path.join(getStorageDir(opts), PACKS_DIR_NAME);
}

/**
 * Initialize storage directories
 * Creates ~/.promptg/prompts/, ~/.promptg/templates/, and ~/.promptg/packs/ if they don't exist
 */
export async function initializeDirectories(opts?: StorageOptions): Promise<void> {
  const dirs = [getPromptsDir(opts), getTemplatesDir(opts), getPacksDir(opts)];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (getNodeErrorCode(error) !== 'EEXIST') {
        throw new InfraError({
          infraCode: 'IO',
          message: `Failed to create directory ${dir}: ${toErrorMessage(error)}`,
          details: { dir, cause: error instanceof Error ? error.message : String(error) },
        });
      }
    }
  }
}

/**
 * Save a prompt to disk
 * Saves to <root>/prompts/{name}.json
 */
export async function savePrompt(prompt: Prompt, opts?: StorageOptions): Promise<void> {
  await initializeDirectories(opts);

  // Ensure shareable prompt metadata defaults exist.
  if (!prompt.schemaVersion) prompt.schemaVersion = PROMPT_SCHEMA_VERSION;
  if (!prompt.displayName) prompt.displayName = prompt.name;
  if (!prompt[X_PROMPTG_TIME]?.createdAt) {
    const existing = prompt[X_PROMPTG_TIME] ?? {};
    prompt[X_PROMPTG_TIME] = { ...existing, createdAt: new Date().toISOString() };
  }

  const filePath = path.join(getPromptsDir(opts), promptFileName(prompt.name));

  try {
    // Prompts do not persist derived fields.
    const toSave = { ...prompt } as Record<string, unknown>;
    const schemaUrl =
      typeof toSave.$schema === 'string' && toSave.$schema.trim().length > 0
        ? toSave.$schema
        : PROMPT_SCHEMA_URL;

    // Keep $schema first for readability (JSON key order is otherwise arbitrary).
    delete toSave.$schema;
    const json = JSON.stringify({ $schema: schemaUrl, ...toSave }, null, 2);
    await writeTextFileAtomic(filePath, json, 'utf8');
    invalidatePromptCache(opts);
  } catch (error) {
    throw new InfraError({
      infraCode: 'IO',
      message: `Failed to save prompt "${prompt.name}": ${toErrorMessage(error)}`,
      details: { kind: 'prompt', name: prompt.name, filePath },
    });
  }
}

/**
 * Load a prompt from disk
 * Loads from ~/.promptg/prompts/{name}.json
 * @throws Error if prompt not found
 */
export async function loadPrompt(name: string, opts?: StorageOptions): Promise<Prompt> {
  await initializeDirectories(opts);
  const cache = getPromptCache(opts);
  const cached = cache.promptsByName.get(name);
  if (cached) return cached;
  const filePath = path.join(getPromptsDir(opts), promptFileName(name));

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = parsePromptJsonText(content);
    if (!parsed.ok) {
      throw new InfraError({
        infraCode: 'INVALID_DATA',
        message: `Failed to load prompt "${name}": ${parsed.error}`,
        details: { kind: 'prompt', name, filePath },
      });
    }
    cache.promptsByName.set(parsed.value.name, parsed.value);
    return parsed.value;
  } catch (error) {
    if (getNodeErrorCode(error) === 'ENOENT') {
      throw new StorageNotFoundError('prompt', name);
    }
    if (error instanceof InfraError) throw error;
    throw new InfraError({
      infraCode: 'IO',
      message: `Failed to load prompt "${name}": ${toErrorMessage(error)}`,
      details: { kind: 'prompt', name, filePath },
    });
  }
}

/**
 * List all saved prompts
 * Returns empty array if no prompts exist
 * Sorted by last accessed (most recent first), falls back to createdAt
 */
export async function listPrompts(opts?: StorageOptions): Promise<Prompt[]> {
  const res = await listPromptsWithDiagnostics(opts);
  return res.prompts;
}

export async function listPromptsWithDiagnostics(
  opts?: StorageOptions
): Promise<ListPromptsDiagnostics> {
  await initializeDirectories(opts);

  const promptsDir = getPromptsDir(opts);

  const cache = getPromptCache(opts);
  if (cache.listPromise) return await cache.listPromise;

  cache.listPromise = (async () => {
    try {
      const files = await fs.readdir(promptsDir);
      const jsonFiles = files.filter(
        file => file.startsWith(PROMPT_FILE_PREFIX) && file.endsWith('.json')
      );

      const prompts: Prompt[] = [];
      let invalidFiles = 0;

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(promptsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const parsed = parsePromptJsonText(content);
          if (!parsed.ok) {
            invalidFiles += 1;
            continue;
          }
          prompts.push(parsed.value);
          cache.promptsByName.set(parsed.value.name, parsed.value);
        } catch {
          // Skip invalid JSON files silently (console.warn causes flicker during prompts)
          invalidFiles += 1;
        }
      }

      // Deterministic sort: createdAt desc (fallback 0), then name.
      const promptTime = (p: Prompt): number => {
        const t = p[X_PROMPTG_TIME];
        const createdAt = typeof t?.createdAt === 'string' ? Date.parse(t.createdAt) : NaN;
        return Number.isFinite(createdAt) ? createdAt : 0;
      };

      const sorted = prompts.sort((a, b) => {
        const dt = promptTime(b) - promptTime(a);
        if (dt !== 0) return dt;
        return a.name.localeCompare(b.name);
      });
      return { prompts: sorted, invalidFiles };
    } catch (error) {
      if (getNodeErrorCode(error) === 'ENOENT') {
        return { prompts: [], invalidFiles: 0 };
      }
      throw new InfraError({
        infraCode: 'IO',
        message: `Failed to list prompts: ${toErrorMessage(error)}`,
        details: { dir: promptsDir },
      });
    }
  })();

  return await cache.listPromise;
}

/**
 * Check if a prompt exists
 */
export async function promptExists(name: string, opts?: StorageOptions): Promise<boolean> {
  const filePath = path.join(getPromptsDir(opts), promptFileName(name));

  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a prompt
 */
export async function deletePrompt(name: string, opts?: StorageOptions): Promise<void> {
  const filePath = path.join(getPromptsDir(opts), promptFileName(name));

  try {
    await fs.unlink(filePath);
    invalidatePromptCache(opts);
  } catch (error) {
    if (getNodeErrorCode(error) === 'ENOENT') {
      throw new StorageNotFoundError('prompt', name);
    }
    throw new InfraError({
      infraCode: 'IO',
      message: `Failed to delete prompt "${name}": ${toErrorMessage(error)}`,
      details: { kind: 'prompt', name, filePath },
    });
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(opts?: StorageOptions): Promise<{
  promptCount: number;
  templateCount: number;
  storageDir: string;
  promptsDir: string;
  templatesDir: string;
}> {
  await initializeDirectories(opts);

  const prompts = await listPrompts(opts);

  // Count user templates
  let templateCount = 0;
  try {
    const templateFiles = await fs.readdir(getTemplatesDir(opts));
    templateCount = templateFiles.filter(
      f => f.startsWith(TEMPLATE_FILE_PREFIX) && f.endsWith('.json')
    ).length;
  } catch {
    templateCount = 0;
  }

  return {
    promptCount: prompts.length,
    templateCount,
    storageDir: getStorageDir(opts),
    promptsDir: getPromptsDir(opts),
    templatesDir: getTemplatesDir(opts),
  };
}
