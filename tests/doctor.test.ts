import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeDoctor } from '../src/cli/commands/doctor.js';
import { captureWrites } from './helpers/captureWrites.js';

describe('Doctor Command', () => {
  it('outputs JSON envelope with diagnostics', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'promptg-doctor-'));

    const out = captureWrites(process.stdout);
    await executeDoctor({ requestedMode: 'global', format: 'json', cwd });
    const text = out.text();
    out.restore();

    const parsed = JSON.parse(text) as any;
    expect(parsed.ok).toBe(true);
    expect(parsed.data).toBeTruthy();
    expect(parsed.data.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(parsed.data.cwd).toBe(cwd);
    expect(parsed.data.node).toBeTruthy();
    expect(parsed.data.storeSelection).toBeTruthy();
    expect(parsed.data.stores).toBeTruthy();
    expect(parsed.data.stores.global).toBeTruthy();
    expect(typeof parsed.data.stores.global.rootDir).toBe('string');
  });
});
