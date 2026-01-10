import type { Template } from '../types/index.js';
import { normalizeImportedTemplate } from '../importing/normalize.js';
import { parseJsonText, type ParsedJson } from './json.js';

export type ParsedTemplate = { ok: true; value: Template } | { ok: false; error: string };

export function parseTemplateJsonText(text: string): ParsedTemplate {
  const raw: ParsedJson = parseJsonText(text);
  if (!raw.ok) return raw;
  return normalizeImportedTemplate(raw.value);
}
