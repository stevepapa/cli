import type { Prompt, Template, PromptGTime } from '../types/index.js';
import { validateKebabCaseName } from '../lib/names.js';
import {
  PROMPT_SCHEMA_VERSION,
  TEMPLATE_SCHEMA_VERSION,
  X_PROMPTG_INTERACTIVE,
  X_PROMPTG_TIME,
} from '../spec.js';

export type ImportKind = 'template' | 'prompt';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeVars(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeInteractiveMap(
  value: unknown
): Record<string, { question?: string; help?: string; required?: boolean }> | undefined {
  if (!isRecord(value)) return undefined;

  const out: Record<string, { question?: string; help?: string; required?: boolean }> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!isRecord(v)) continue;
    if (typeof v.question !== 'string' || v.question.trim().length === 0) continue;
    out[k] = {
      question: v.question,
      help: typeof v.help === 'string' ? v.help : undefined,
      required: v.required === true,
    };
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function detectImportKind(data: unknown): ImportKind {
  if (!isRecord(data)) return 'prompt';

  if (typeof data.kind === 'string') {
    const kind = data.kind.trim().toLowerCase();
    if (kind === 'template') return 'template';
    if (kind === 'prompt') return 'prompt';
  }

  return 'prompt';
}

export function normalizeImportedPrompt(
  data: unknown
): { ok: true; value: Prompt } | { ok: false; error: string } {
  if (!isRecord(data)) return { ok: false, error: 'JSON must be an object' };

  if (typeof data.kind !== 'string' || data.kind.trim() !== 'prompt') {
    return { ok: false, error: 'Missing or invalid field: kind (expected "prompt")' };
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const content = typeof data.content === 'string' ? data.content : '';

  if (!name) return { ok: false, error: 'Missing required field: name' };
  const nameError = validateKebabCaseName(name);
  if (nameError) return { ok: false, error: nameError };
  if (!content || content.trim().length === 0) {
    return { ok: false, error: 'Missing required field: content' };
  }

  const schemaVersion = (data as { schemaVersion?: unknown }).schemaVersion;
  if (typeof schemaVersion !== 'string' || schemaVersion !== PROMPT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Missing or invalid field: schemaVersion (expected "${PROMPT_SCHEMA_VERSION}")`,
    };
  }

  const displayName =
    typeof (data as { displayName?: unknown }).displayName === 'string'
      ? ((data as { displayName?: string }).displayName as string)
      : name;

  const author =
    typeof (data as { author?: unknown }).author === 'string'
      ? ((data as { author?: string }).author as string)
      : undefined;

  const tags =
    Array.isArray(data.tags) && data.tags.every(t => typeof t === 'string')
      ? (data.tags as string[])
      : undefined;

  const description = typeof data.description === 'string' ? data.description : undefined;

  const extensions: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('x-')) continue;
    if (k === X_PROMPTG_INTERACTIVE || k === X_PROMPTG_TIME) continue;
    extensions[k] = v;
  }

  const interactive = normalizeInteractiveMap(
    (data as Record<string, unknown>)[X_PROMPTG_INTERACTIVE]
  );

  const time: PromptGTime = {};
  const timeCandidate = (data as Record<string, unknown>)[X_PROMPTG_TIME];
  if (isRecord(timeCandidate)) {
    if (typeof timeCandidate.createdAt === 'string') time.createdAt = timeCandidate.createdAt;
  }

  const defaults = normalizeVars((data as { defaults?: unknown }).defaults);

  return {
    ok: true,
    value: {
      kind: 'prompt',
      schemaVersion,
      name,
      displayName,
      description,
      content,
      author,
      tags,
      defaults,
      ...(interactive ? { [X_PROMPTG_INTERACTIVE]: interactive } : {}),
      ...(time.createdAt ? { [X_PROMPTG_TIME]: time } : {}),
      ...extensions,
    },
  };
}

export function normalizeImportedTemplate(
  data: unknown
): { ok: true; value: Template } | { ok: false; error: string } {
  if (!isRecord(data)) return { ok: false, error: 'JSON must be an object' };

  if (typeof data.kind !== 'string' || data.kind.trim() !== 'template') {
    return { ok: false, error: 'Missing or invalid field: kind (expected "template")' };
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : '';
  const description = typeof data.description === 'string' ? data.description : '';
  const promptCandidate = (data as Record<string, unknown>).prompt;

  if (!name) return { ok: false, error: 'Missing required field: name' };
  const nameError = validateKebabCaseName(name);
  if (nameError) return { ok: false, error: nameError };
  if (!displayName) return { ok: false, error: 'Missing required field: displayName' };
  if (!description || description.trim().length === 0) {
    return { ok: false, error: 'Missing required field: description' };
  }

  const tags =
    Array.isArray(data.tags) && data.tags.every(t => typeof t === 'string')
      ? (data.tags as string[])
      : undefined;

  const author = typeof data.author === 'string' ? data.author : undefined;
  const schemaVersion = (data as { schemaVersion?: unknown }).schemaVersion;
  if (typeof schemaVersion !== 'string' || schemaVersion !== TEMPLATE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Missing or invalid field: schemaVersion (expected "${TEMPLATE_SCHEMA_VERSION}")`,
    };
  }

  if (!isRecord(promptCandidate)) {
    return { ok: false, error: 'Missing required field: prompt' };
  }

  const normalizedPrompt = normalizeImportedPrompt(promptCandidate);
  if (!normalizedPrompt.ok) {
    return { ok: false, error: `Invalid embedded prompt: ${normalizedPrompt.error}` };
  }

  if (normalizedPrompt.value.schemaVersion !== schemaVersion) {
    return {
      ok: false,
      error: 'Embedded prompt schemaVersion must match template schemaVersion',
    };
  }

  const extensions: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('x-')) continue;
    extensions[k] = v;
  }

  return {
    ok: true,
    value: {
      kind: 'template',
      schemaVersion,
      name,
      displayName,
      description,
      prompt: normalizedPrompt.value,
      tags,
      author,
      ...extensions,
    },
  };
}
