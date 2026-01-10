export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const mod = await import('clipboardy');
    const api =
      (mod as unknown as { default?: { write?: (text: string) => Promise<void> } }).default ??
      (mod as unknown as { write?: (text: string) => Promise<void> });
    if (!api.write) return false;
    await api.write(text);
    return true;
  } catch {
    return false;
  }
}
