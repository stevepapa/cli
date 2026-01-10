import type { Prompt } from '../types/index.js';
import { normalizeImportedPrompt } from '../importing/normalize.js';
import { parseJsonText, type ParsedJson } from './json.js';

export type ParsedPrompt = { ok: true; value: Prompt } | { ok: false; error: string };

export function parsePromptJsonText(text: string): ParsedPrompt {
  const raw: ParsedJson = parseJsonText(text);
  if (!raw.ok) return raw;
  return normalizeImportedPrompt(raw.value);
}
