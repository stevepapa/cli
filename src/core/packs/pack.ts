import type { Prompt, Template, PromptPack } from '../types/index.js';
import { validateKebabCaseName } from '../lib/names.js';
import { PACK_SCHEMA_VERSION } from '../spec.js';
import { normalizeImportedPrompt, normalizeImportedTemplate } from '../importing/normalize.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSemver(value: string): boolean {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/.test(
    value
  );
}

export function normalizePromptPack(
  data: unknown
):
  | { ok: true; value: PromptPack & { prompts: Prompt[]; templates: Template[] } }
  | { ok: false; error: string } {
  if (!isRecord(data)) return { ok: false, error: 'Pack JSON must be an object' };

  const kind = typeof data.kind === 'string' ? data.kind.trim() : '';
  if (!kind) return { ok: false, error: 'Missing required field: kind' };
  if (kind !== 'pack') return { ok: false, error: `Invalid pack kind: ${kind}` };

  const schemaVersion = typeof data.schemaVersion === 'string' ? data.schemaVersion.trim() : '';
  if (!schemaVersion) return { ok: false, error: 'Missing required field: schemaVersion' };
  if (schemaVersion !== PACK_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported pack schemaVersion: ${schemaVersion}` };
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) return { ok: false, error: 'Missing required field: name' };
  const nameError = validateKebabCaseName(name);
  if (nameError) return { ok: false, error: nameError };

  const version = typeof data.version === 'string' ? data.version.trim() : '';
  if (!version) return { ok: false, error: 'Missing required field: version' };
  if (!isSemver(version))
    return { ok: false, error: 'version must be a semver string (e.g., 1.2.3)' };

  const displayName =
    typeof (data as { displayName?: unknown }).displayName === 'string'
      ? ((data as { displayName?: string }).displayName as string)
      : undefined;
  const description = typeof data.description === 'string' ? data.description : undefined;
  const homepage = typeof data.homepage === 'string' ? data.homepage : undefined;
  const author = typeof data.author === 'string' ? data.author : undefined;
  const tags =
    Array.isArray(data.tags) && data.tags.every(t => typeof t === 'string')
      ? (data.tags as string[])
      : undefined;

  const rawPrompts = Array.isArray(data.prompts) ? (data.prompts as unknown[]) : [];
  const rawTemplates = Array.isArray(data.templates) ? (data.templates as unknown[]) : [];

  if (rawPrompts.length === 0 && rawTemplates.length === 0) {
    return { ok: false, error: 'Pack must include at least one prompt or template' };
  }

  const prompts: Prompt[] = [];
  const templates: Template[] = [];

  const seenPromptNames = new Set<string>();
  const seenTemplateNames = new Set<string>();

  for (const item of rawPrompts) {
    const normalized = normalizeImportedPrompt(item);
    if (!normalized.ok) return { ok: false, error: `Invalid prompt: ${normalized.error}` };
    if (seenPromptNames.has(normalized.value.name)) {
      return { ok: false, error: `Duplicate prompt in pack: ${normalized.value.name}` };
    }
    seenPromptNames.add(normalized.value.name);
    prompts.push(normalized.value);
  }

  for (const item of rawTemplates) {
    const normalized = normalizeImportedTemplate(item);
    if (!normalized.ok) return { ok: false, error: `Invalid template: ${normalized.error}` };
    if (seenTemplateNames.has(normalized.value.name)) {
      return { ok: false, error: `Duplicate template in pack: ${normalized.value.name}` };
    }
    seenTemplateNames.add(normalized.value.name);
    templates.push(normalized.value);
  }

  return {
    ok: true,
    value: {
      kind: 'pack',
      schemaVersion,
      name,
      version,
      displayName,
      description,
      homepage,
      author,
      tags,
      prompts,
      templates,
    },
  };
}
