import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { editTextInExternalEditor } from '../../../node/editor/externalEditor.js';

function safeFileHint(hint: string): string {
  const trimmed = hint.trim().slice(0, 64);
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return safe.length > 0 ? safe : 'promptg';
}

export function stripHashCommentLines(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const kept = lines.filter(line => !line.trimStart().startsWith('#'));
  return kept.join('\n').trim();
}

export async function editInEditor(params: {
  initial: string;
  filenameHint: string;
}): Promise<string | null> {
  return await editTextInExternalEditor(params);
}

export async function writeTempFile(params: {
  prefix: string;
  filenameHint: string;
  ext: string;
  content: string;
}): Promise<string> {
  const name = `${params.prefix}-${Date.now()}-${safeFileHint(params.filenameHint)}${params.ext}`;
  const filePath = path.join(os.tmpdir(), name);
  await fs.writeFile(filePath, params.content, 'utf8');
  return filePath;
}
