/**
 * UTF-8 BOM detection and encoding validation
 */

export function hasBOM(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

export function validateEncoding(buffer: Buffer): { ok: true } | { ok: false; error: string } {
  if (hasBOM(buffer)) {
    return {
      ok: false,
      error: 'UTF-8 BOM detected. PromptG files must be UTF-8 without BOM.',
    };
  }

  return { ok: true };
}
