import { toErrorMessage } from '../lib/errors.js';

export type ParsedJson = { ok: true; value: unknown } | { ok: false; error: string };

export function parseJsonText(text: string): ParsedJson {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${toErrorMessage(e)}` };
  }
}
