import { vi } from 'vitest';

export function captureWrites(stream: NodeJS.WriteStream): {
  text: () => string;
  restore: () => void;
} {
  const spy = vi.spyOn(stream, 'write').mockImplementation(() => true);
  return {
    text: () => spy.mock.calls.map(c => String(c[0] ?? '')).join(''),
    restore: () => spy.mockRestore(),
  };
}
