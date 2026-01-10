function safeFileHint(hint: string): string {
  const trimmed = hint.trim().slice(0, 64);
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return safe.length > 0 ? safe : 'prompt';
}

export async function editTextInExternalEditor(params: {
  initial: string;
  filenameHint: string;
}): Promise<string | null> {
  try {
    const mod = await import('@inquirer/external-editor');
    if (typeof mod.edit !== 'function') return null;

    const postfix = `-${safeFileHint(params.filenameHint)}.txt`;
    return mod.edit(params.initial, { prefix: 'promptg-', postfix });
  } catch {
    return null;
  }
}
