/**
 * Template System - Loads and manages prompt templates
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Template } from '../../core/types/index.js';
import { getTemplatesDir, initializeDirectories, type StorageOptions } from './storage.js';
import {
  TEMPLATE_FILE_PREFIX,
  TEMPLATE_SCHEMA_URL,
  TEMPLATE_SCHEMA_VERSION,
  X_PROMPTG_TIME,
} from '../../core/spec.js';
import { parseTemplateJsonText } from '../../core/parsing/template.js';
import { writeTextFileAtomic } from '../fs/writeAtomic.js';
import { getNodeErrorCode, toErrorMessage } from '../../core/lib/errors.js';
import { StorageNotFoundError } from './errors.js';
import { InfraError } from '../../core/infra/errors.js';

function userTemplateFileName(name: string): string {
  return `${TEMPLATE_FILE_PREFIX}${name}.json`;
}

function templateFilePath(name: string, opts?: StorageOptions): string {
  return path.join(getTemplatesDir(opts), userTemplateFileName(name));
}

/**
 * Load a single template file
 */
async function tryLoadTemplateFile(filePath: string): Promise<Template | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = parseTemplateJsonText(content);
    if (!parsed.ok) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

async function loadTemplateFileOrThrow(params: {
  name: string;
  filePath: string;
}): Promise<Template> {
  try {
    const content = await fs.readFile(params.filePath, 'utf-8');
    const parsed = parseTemplateJsonText(content);
    if (!parsed.ok) {
      throw new InfraError({
        infraCode: 'INVALID_DATA',
        message: `Failed to load template "${params.name}": ${parsed.error}`,
        details: { kind: 'template', name: params.name, filePath: params.filePath },
      });
    }
    return parsed.value;
  } catch (error) {
    if (getNodeErrorCode(error) === 'ENOENT') {
      throw new StorageNotFoundError('template', params.name);
    }
    if (error instanceof InfraError) throw error;
    throw new InfraError({
      infraCode: 'IO',
      message: `Failed to load template "${params.name}": ${toErrorMessage(error)}`,
      details: { kind: 'template', name: params.name, filePath: params.filePath },
    });
  }
}

/**
 * Load all templates from a directory
 */
async function loadTemplatesFromDir(
  dir: string,
  opts?: { filenameFilter?: (fileName: string) => boolean }
): Promise<{ templates: Template[]; invalidFiles: number }> {
  try {
    const files = await fs.readdir(dir);
    const jsonFiles = files.filter(file => {
      if (!file.endsWith('.json')) return false;
      return opts?.filenameFilter ? opts.filenameFilter(file) : true;
    });

    const templates: Template[] = [];
    let invalidFiles = 0;

    for (const file of jsonFiles) {
      const filePath = path.join(dir, file);
      const template = await tryLoadTemplateFile(filePath);

      if (template) {
        templates.push(template);
      } else {
        invalidFiles += 1;
      }
    }

    return { templates, invalidFiles };
  } catch {
    // Directory doesn't exist or can't be read
    return { templates: [], invalidFiles: 0 };
  }
}

/**
 * Load all templates from the global user store.
 */
export async function loadTemplates(): Promise<Template[]> {
  const res = await loadTemplatesWithDiagnostics();
  return res.templates;
}

export async function loadTemplatesFromStore(opts?: StorageOptions): Promise<Template[]> {
  const res = await loadTemplatesFromStoreWithDiagnostics(opts);
  return res.templates;
}

export async function loadTemplatesWithDiagnostics(): Promise<{
  templates: Template[];
  invalidFiles: number;
}> {
  await initializeDirectories();
  const userDir = getTemplatesDir();
  const res = await loadTemplatesFromDir(userDir, {
    filenameFilter: file => file.startsWith(TEMPLATE_FILE_PREFIX),
  });
  return {
    templates: res.templates.sort((a, b) => a.name.localeCompare(b.name)),
    invalidFiles: res.invalidFiles,
  };
}

export async function loadTemplatesFromStoreWithDiagnostics(opts?: StorageOptions): Promise<{
  templates: Template[];
  invalidFiles: number;
}> {
  await initializeDirectories(opts);
  const userDir = getTemplatesDir(opts);
  const res = await loadTemplatesFromDir(userDir, {
    filenameFilter: file => file.startsWith(TEMPLATE_FILE_PREFIX),
  });
  return {
    templates: res.templates.sort((a, b) => a.name.localeCompare(b.name)),
    invalidFiles: res.invalidFiles,
  };
}

/**
 * Load a single template by name
 * @throws Error if template not found
 */
export async function loadTemplate(name: string): Promise<Template> {
  await initializeDirectories();
  return await loadTemplateFileOrThrow({ name, filePath: templateFilePath(name) });
}

export async function loadTemplateFromStore(
  name: string,
  opts?: StorageOptions
): Promise<Template> {
  await initializeDirectories(opts);
  return await loadTemplateFileOrThrow({ name, filePath: templateFilePath(name, opts) });
}

/**
 * Check if a template exists
 */
export async function templateExists(name: string): Promise<boolean> {
  try {
    await fs.access(templateFilePath(name));
    return true;
  } catch {
    return false;
  }
}

export async function templateExistsInStore(name: string, opts?: StorageOptions): Promise<boolean> {
  try {
    await fs.access(templateFilePath(name, opts));
    return true;
  } catch {
    return false;
  }
}

export async function saveTemplate(template: Template, opts?: StorageOptions): Promise<void> {
  await initializeDirectories(opts);

  if (!template.schemaVersion) template.schemaVersion = TEMPLATE_SCHEMA_VERSION;
  if (!template[X_PROMPTG_TIME]?.createdAt) {
    const existing = template[X_PROMPTG_TIME] ?? {};
    template[X_PROMPTG_TIME] = { ...existing, createdAt: new Date().toISOString() };
  }

  const filePath = templateFilePath(template.name, opts);

  try {
    // Templates do not persist derived fields.
    const toSave = { ...template } as Record<string, unknown>;
    const schemaUrl =
      typeof toSave.$schema === 'string' && toSave.$schema.trim().length > 0
        ? toSave.$schema
        : TEMPLATE_SCHEMA_URL;

    delete toSave.$schema;
    const json = JSON.stringify({ $schema: schemaUrl, ...toSave }, null, 2);
    await writeTextFileAtomic(filePath, json, 'utf8');
  } catch (error) {
    throw new InfraError({
      infraCode: 'IO',
      message: `Failed to save template "${template.name}": ${toErrorMessage(error)}`,
      details: { kind: 'template', name: template.name, filePath },
    });
  }
}

export async function deleteTemplate(name: string, opts?: StorageOptions): Promise<void> {
  const filePath = templateFilePath(name, opts);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (getNodeErrorCode(error) === 'ENOENT') {
      throw new StorageNotFoundError('template', name);
    }
    throw new InfraError({
      infraCode: 'IO',
      message: `Failed to delete template "${name}": ${toErrorMessage(error)}`,
      details: { kind: 'template', name, filePath },
    });
  }
}
