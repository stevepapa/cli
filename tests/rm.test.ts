import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as storage from '../src/node/storage/storage.js';
import { executeRm } from '../src/cli/commands/rm.js';
import { handleError } from '../src/cli/output.js';
import type { Prompt } from '../src/core/types/index.js';
import { cleanupTempStore, makeTempStore } from './helpers/tempStore.js';

describe('Rm Command', () => {
  it('deletes a prompt from the specified store', async () => {
    const temp = await makeTempStore('promptg-rm-');
    const store = temp.store;
    await fs.mkdir(store.rootDir!, { recursive: true });
    await storage.initializeDirectories(store);

    const name = `test-rm-${Date.now()}`;
    const prompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name,
      displayName: name,
      content: 'Hello',
      'x-promptg-time': { createdAt: new Date().toISOString() },
    };
    await storage.savePrompt(prompt, store);
    expect(await storage.promptExists(name, store)).toBe(true);

    const errWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await executeRm(name, store, 'project');

    expect(await storage.promptExists(name, store)).toBe(false);
    const errText = errWriteSpy.mock.calls.map(c => String(c[0] ?? '')).join('');
    expect(errText).toContain(`Removed prompt "${name}".`);
    expect(errText).toContain('Store:');

    errWriteSpy.mockRestore();
    await cleanupTempStore(temp.tmpDir);
  });

  it('errors when prompt is missing in auto project mode (no global fallback)', async () => {
    const tempProject = await makeTempStore('promptg-rm-project-');
    const store = tempProject.store;
    await fs.mkdir(store.rootDir!, { recursive: true });
    await storage.initializeDirectories(store);

    const name = `test-rm-missing-${Date.now()}`;

    const tempGlobal = await makeTempStore('promptg-rm-global-');
    await storage.initializeDirectories(tempGlobal.store);
    await storage.savePrompt(
      {
        kind: 'prompt',
        schemaVersion: '1',
        name,
        displayName: name,
        content: 'Hello',
        'x-promptg-time': { createdAt: new Date().toISOString() },
      },
      tempGlobal.store
    );

    const originalPromptExists = storage.promptExists;
    const promptExistsSpy = vi
      .spyOn(storage, 'promptExists')
      .mockImplementation((n, opts) =>
        opts?.rootDir ? originalPromptExists(n, opts) : originalPromptExists(n, tempGlobal.store)
      );

    const errWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    let thrown: unknown = null;
    try {
      await executeRm(name, store, 'auto');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeTruthy();

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    }) as never);

    expect(() => handleError(thrown)).toThrow('exit:1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    const errText = errWriteSpy.mock.calls.map(c => String(c[0] ?? '')).join('');
    expect(errText).toContain(`error: Prompt "${name}" not found.`);
    expect(errText).toContain('hint:');
    expect(errText).toContain('Try: promptg prompt rm');

    promptExistsSpy.mockRestore();
    errWriteSpy.mockRestore();
    exitSpy.mockRestore();
    await cleanupTempStore(tempProject.tmpDir);
    await cleanupTempStore(tempGlobal.tmpDir);
  });
});
