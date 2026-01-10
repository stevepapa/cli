import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { StorageOptions } from '../src/node/storage/storage.js';
import { getPromptsDir, initializeDirectories } from '../src/node/storage/storage.js';
import { executeValidate } from '../src/cli/commands/validate.js';
import { executeStatus } from '../src/cli/commands/status.js';
import { handleError } from '../src/cli/output.js';
import { runCli } from '../src/cli/index.js';
import { captureWrites } from './helpers/captureWrites.js';

describe('CLI output contracts', () => {
  it('help in json mode returns a success envelope and no stderr output', async () => {
    const out = captureWrites(process.stdout);
    const err = captureWrites(process.stderr);

    await runCli(['node', 'promptg', '--format', 'json', '--help']);

    expect(err.text()).toBe('');
    const parsed = JSON.parse(out.text()) as {
      ok: boolean;
      data: { help: string };
      warnings: unknown[];
    };
    expect(parsed.ok).toBe(true);
    expect(typeof parsed.data.help).toBe('string');
    expect(parsed.data.help).toContain('USAGE');
    expect(Array.isArray(parsed.warnings)).toBe(true);

    out.restore();
    err.restore();
  });

  it('unknown command in json mode returns a USAGE error envelope and exit 2', async () => {
    const out = captureWrites(process.stdout);
    const err = captureWrites(process.stderr);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    }) as never);

    await expect(runCli(['node', 'promptg', 'nope', '--format', 'json'])).rejects.toThrow('exit:2');

    expect(err.text()).toBe('');
    const parsed = JSON.parse(out.text()) as {
      ok: boolean;
      error: { code: string; message: string };
      warnings: unknown[];
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('USAGE');
    expect(typeof parsed.error.message).toBe('string');
    expect(Array.isArray(parsed.warnings)).toBe(true);

    out.restore();
    err.restore();
    exitSpy.mockRestore();
  });

  it('validate --format json outputs valid JSON only', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptg-validate-'));
    const store: StorageOptions = { rootDir: path.join(tmpDir, '.promptg') };
    await initializeDirectories(store);

    const out = captureWrites(process.stdout);
    const err = captureWrites(process.stderr);

    await executeValidate(store, { format: 'json' });

    expect(err.text()).toBe('');
    const parsed = JSON.parse(out.text()) as {
      ok: boolean;
      data: { issues: unknown[] };
      warnings: unknown[];
    };
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.data.issues)).toBe(true);
    expect(Array.isArray(parsed.warnings)).toBe(true);

    out.restore();
    err.restore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('validate exits 1 on issues in json mode', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptg-validate-'));
    const store: StorageOptions = { rootDir: path.join(tmpDir, '.promptg') };
    await initializeDirectories(store);

    const badPromptPath = path.join(getPromptsDir(store), 'promptg-prompt-bad.json');
    await fs.writeFile(badPromptPath, JSON.stringify({ name: 'bad' }, null, 2), 'utf8');

    const out = captureWrites(process.stdout);
    const err = captureWrites(process.stderr);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    }) as never);

    let thrown: unknown = null;
    try {
      await executeValidate(store, { format: 'json' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeTruthy();

    expect(() => handleError(thrown, { format: 'json' })).toThrow('exit:1');

    const parsed = JSON.parse(out.text()) as {
      ok: boolean;
      error: { code: string; message: string; details?: { issues?: unknown[] } };
      warnings: unknown[];
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('VALIDATION');
    expect(Array.isArray(parsed.error.details?.issues)).toBe(true);
    expect(err.text()).toBe('');

    out.restore();
    err.restore();
    exitSpy.mockRestore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('status --format json outputs valid JSON only', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptg-info-'));
    const storeRoot = path.join(tmpDir, '.promptg');
    const store: StorageOptions = { rootDir: storeRoot };
    await initializeDirectories(store);

    const out = captureWrites(process.stdout);
    const err = captureWrites(process.stderr);

    await executeStatus({ format: 'json', cwd: tmpDir });

    expect(err.text()).toBe('');
    const parsed = JSON.parse(out.text()) as {
      ok: boolean;
      data: {
        version: string;
        cwd: string;
        globalStore: unknown;
        projectStore: { root: string } | null;
        conventions: unknown;
      };
      warnings: unknown[];
    };
    expect(parsed.ok).toBe(true);
    expect(typeof parsed.data.version).toBe('string');
    expect(parsed.data.cwd).toBe(tmpDir);
    expect(parsed.data.globalStore).toBeTruthy();
    expect(parsed.data.projectStore?.root).toBe(storeRoot);
    expect(parsed.data.conventions).toBeTruthy();
    expect(Array.isArray(parsed.warnings)).toBe(true);

    out.restore();
    err.restore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
