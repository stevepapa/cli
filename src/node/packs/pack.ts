import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Prompt, Template, PromptPack } from '../../core/types/index.js';
import { validateKebabCaseName } from '../../core/lib/names.js';
import { InfraError } from '../../core/infra/errors.js';
import {
  PACK_FILE_PREFIX,
  PACK_SCHEMA_URL,
  PACK_SCHEMA_VERSION,
  PROMPT_FILE_PREFIX,
  PROMPT_SCHEMA_VERSION,
  TEMPLATE_FILE_PREFIX,
  TEMPLATE_SCHEMA_VERSION,
  X_PROMPTG_TIME,
} from '../../core/spec.js';
import {
  getPacksDir,
  getPromptsDir,
  getTemplatesDir,
  initializeDirectories,
  listPrompts,
  loadPrompt,
  savePrompt,
  type StorageOptions,
} from '../storage/storage.js';
import {
  loadTemplateFromStore,
  loadTemplatesFromStore,
  saveTemplate,
} from '../storage/templates.js';
import { readJsonFromFile, readJsonFromUrl } from '../importing/importer.js';

export { normalizePromptPack } from '../../core/packs/pack.js';

function isSemver(value: string): boolean {
  // Strict semver 2.0.0 validation (matches pack.schema.json)
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/.test(
    value
  );
}

export function packFileName(name: string): string {
  return `${PACK_FILE_PREFIX}${name}.json`;
}

export function getPackFilePath(name: string, store?: StorageOptions): string {
  return path.join(getPacksDir(store), packFileName(name));
}

function templateFilePath(name: string, store?: StorageOptions): string {
  return path.join(getTemplatesDir(store), `${TEMPLATE_FILE_PREFIX}${name}.json`);
}

function promptFilePath(name: string, store?: StorageOptions): string {
  return path.join(getPromptsDir(store), `${PROMPT_FILE_PREFIX}${name}.json`);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readPackFromSource(sourceInput: string): Promise<unknown> {
  const source = sourceInput.trim();
  const isUrl = /^https?:\/\//i.test(source);
  return isUrl ? await readJsonFromUrl(source) : await readJsonFromFile(source);
}

export async function installPromptPack(params: {
  pack: PromptPack & { prompts: Prompt[]; templates: Template[] };
  store?: StorageOptions;
  force: boolean;
  onlyNew: boolean;
}): Promise<{
  installedPrompts: string[];
  skippedPrompts: string[];
  installedTemplates: string[];
  skippedTemplates: string[];
}> {
  await initializeDirectories(params.store);
  const promptNames = params.pack.prompts.map(p => p.name);
  const templateNames = params.pack.templates.map(t => t.name);

  const [promptExistsPairs, templateExistsPairs] = await Promise.all([
    Promise.all(
      promptNames.map(
        async name => [name, await fileExists(promptFilePath(name, params.store))] as const
      )
    ),
    Promise.all(
      templateNames.map(
        async name => [name, await fileExists(templateFilePath(name, params.store))] as const
      )
    ),
  ]);

  const promptsThatExist = promptExistsPairs.filter(([, exists]) => exists).map(([name]) => name);
  const templatesThatExist = templateExistsPairs
    .filter(([, exists]) => exists)
    .map(([name]) => name);

  const hasConflicts = promptsThatExist.length > 0 || templatesThatExist.length > 0;
  if (hasConflicts && !params.force && !params.onlyNew) {
    const parts: string[] = [];
    if (promptsThatExist.length > 0) parts.push(`prompts: ${promptsThatExist.join(', ')}`);
    if (templatesThatExist.length > 0) parts.push(`templates: ${templatesThatExist.join(', ')}`);
    throw new InfraError({
      infraCode: 'CONFLICT',
      message: `Pack contains items that already exist (${parts.join(' | ')}). Use --force to overwrite or --only-new to skip.`,
      details: {
        promptsThatExist,
        templatesThatExist,
      },
    });
  }

  const installedPrompts: string[] = [];
  const skippedPrompts: string[] = [];
  const installedTemplates: string[] = [];
  const skippedTemplates: string[] = [];

  for (const template of params.pack.templates) {
    const exists = templatesThatExist.includes(template.name);
    if (exists && params.onlyNew) {
      skippedTemplates.push(template.name);
      continue;
    }

    const now = new Date().toISOString();
    let createdAt = template[X_PROMPTG_TIME]?.createdAt;
    if (exists && params.force) {
      try {
        const existing = await loadTemplateFromStore(template.name, params.store);
        createdAt = existing[X_PROMPTG_TIME]?.createdAt ?? createdAt;
      } catch {
        // best effort
      }
    }
    if (!createdAt) createdAt = now;

    const toWrite: Template = {
      ...template,
      kind: 'template',
      schemaVersion: template.schemaVersion || TEMPLATE_SCHEMA_VERSION,
      [X_PROMPTG_TIME]: { createdAt },
    };

    await saveTemplate(toWrite, params.store);
    installedTemplates.push(template.name);
  }

  for (const prompt of params.pack.prompts) {
    const exists = promptsThatExist.includes(prompt.name);
    if (exists && params.onlyNew) {
      skippedPrompts.push(prompt.name);
      continue;
    }

    const now = new Date().toISOString();
    let createdAt = prompt[X_PROMPTG_TIME]?.createdAt;
    if (exists && params.force) {
      try {
        const existing = await loadPrompt(prompt.name, params.store);
        createdAt = existing[X_PROMPTG_TIME]?.createdAt ?? createdAt;
      } catch {
        // best effort
      }
    }
    if (!createdAt) createdAt = now;

    const toSave: Prompt = {
      ...prompt,
      kind: 'prompt',
      schemaVersion: prompt.schemaVersion || PROMPT_SCHEMA_VERSION,
      [X_PROMPTG_TIME]: { createdAt },
    };

    await savePrompt(toSave, params.store);
    installedPrompts.push(prompt.name);
  }

  return { installedPrompts, skippedPrompts, installedTemplates, skippedTemplates };
}

export async function buildPromptPack(params: {
  name: string;
  version: string;
  store?: StorageOptions;
  force: boolean;
}): Promise<{ filePath: string; pack: PromptPack }> {
  const nameError = validateKebabCaseName(params.name);
  if (nameError) throw new InfraError({ infraCode: 'INVALID_DATA', message: nameError });
  if (!isSemver(params.version)) {
    throw new InfraError({
      infraCode: 'INVALID_DATA',
      message: 'version must be a semver string (e.g., 1.2.3)',
      details: { version: params.version },
    });
  }

  await initializeDirectories(params.store);

  const [prompts, templates] = await Promise.all([
    listPrompts(params.store),
    loadTemplatesFromStore(params.store),
  ]);

  const sortedPrompts = [...prompts].sort((a, b) => a.name.localeCompare(b.name));
  const sortedTemplates = [...templates].sort((a, b) => a.name.localeCompare(b.name));

  if (sortedPrompts.length === 0 && sortedTemplates.length === 0) {
    throw new InfraError({
      infraCode: 'INVALID_DATA',
      message: 'No prompts or templates found in the selected store.',
    });
  }

  const pack: PromptPack = {
    $schema: PACK_SCHEMA_URL,
    kind: 'pack',
    schemaVersion: PACK_SCHEMA_VERSION,
    name: params.name,
    version: params.version,
    prompts: sortedPrompts,
    templates: sortedTemplates,
  };

  const outDir = getPacksDir(params.store);
  await fs.mkdir(outDir, { recursive: true });
  const filePath = getPackFilePath(params.name, params.store);

  const exists = await fileExists(filePath);
  if (exists && !params.force) {
    throw new InfraError({
      infraCode: 'CONFLICT',
      message: `Pack file already exists: ${filePath}. Use --force to overwrite.`,
      details: { filePath },
    });
  }

  await fs.writeFile(filePath, JSON.stringify(pack, null, 2), 'utf8');
  return { filePath, pack };
}
