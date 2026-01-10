import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as storage from '../src/node/storage/storage.js';
import { executeGet } from '../src/cli/commands/get.js';
import type { Prompt } from '../src/core/types/index.js';
import { captureWrites } from './helpers/captureWrites.js';
import { cleanupTempStore, makeTempStore, type TempStore } from './helpers/tempStore.js';
import { createCliServices } from '../src/cli/services.js';

describe('Get Command', () => {
  let temp: TempStore;
  const services = createCliServices();

  beforeEach(async () => {
    temp = await makeTempStore('promptg-get-');
    await storage.initializeDirectories(temp.store);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupTempStore(temp.tmpDir);
  });

  it('should use prefilled vars from prompt JSON', async () => {
    const name = `test-get-prompt-${Date.now()}`;

    const prompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name,
      content: 'Hello {{name}} from {{place}}',
      defaults: { name: 'Alice' },
      'x-promptg-time': { createdAt: new Date().toISOString() },
    };

    await storage.savePrompt(prompt, temp.store);

    const out = captureWrites(process.stdout);
    await executeGet(services, name, {}, temp.store);
    expect(out.text().trim()).toBe('Hello Alice from {{place}}');
    out.restore();

    if (await storage.promptExists(name, temp.store)) await storage.deletePrompt(name, temp.store);
  });

  it('should output generated prompt by default', async () => {
    const name = `test-get-default-${Date.now()}`;

    const prompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name,
      content: 'Hello {{name}}',
      defaults: { name: 'Alice' },
      'x-promptg-time': { createdAt: new Date().toISOString() },
    };

    await storage.savePrompt(prompt, temp.store);

    const out = captureWrites(process.stdout);
    await executeGet(services, name, {}, temp.store);
    expect(out.text().trim()).toBe('Hello Alice');
    out.restore();

    if (await storage.promptExists(name, temp.store)) await storage.deletePrompt(name, temp.store);
  });

  it('should support --unfilled output (no injected values)', async () => {
    const name = `test-get-unfilled-${Date.now()}`;

    const prompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name,
      content: 'Hello {{name}}',
      defaults: { name: 'Alice' },
      'x-promptg-time': { createdAt: new Date().toISOString() },
    };

    await storage.savePrompt(prompt, temp.store);

    const out = captureWrites(process.stdout);
    await executeGet(services, name, { unfilled: true }, temp.store);
    expect(out.text().trim()).toBe('Hello {{name}}');
    out.restore();

    if (await storage.promptExists(name, temp.store)) await storage.deletePrompt(name, temp.store);
  });

  it('should let CLI vars override prefilled vars', async () => {
    const name = `test-get-prompt-override-${Date.now()}`;

    const prompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name,
      content: 'Hello {{name}}',
      defaults: { name: 'Alice' },
      'x-promptg-time': { createdAt: new Date().toISOString() },
    };

    await storage.savePrompt(prompt, temp.store);

    const out = captureWrites(process.stdout);
    await executeGet(services, name, { 'var:name': 'Bob' }, temp.store);
    expect(out.text().trim()).toBe('Hello Bob');
    out.restore();

    if (await storage.promptExists(name, temp.store)) await storage.deletePrompt(name, temp.store);
  });

  it('should support --info output (header + prompt)', async () => {
    const name = `test-get-info-${Date.now()}`;

    const prompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name,
      description: 'Example',
      content: 'Hello {{name}}',
      defaults: { name: 'Alice' },
      'x-promptg-time': { createdAt: new Date().toISOString() },
    };

    await storage.savePrompt(prompt, temp.store);

    const out = captureWrites(process.stdout);
    await executeGet(services, name, { info: true }, temp.store);
    const output = out.text();
    expect(output).toContain('Title:');
    expect(output).toContain('Description:');
    expect(output).toContain('Hello Alice');
    out.restore();

    if (await storage.promptExists(name, temp.store)) await storage.deletePrompt(name, temp.store);
  });

  it('falls back to global when project store is present (auto mode)', async () => {
    const name = `test-get-fallback-${Date.now()}`;

    const prompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name,
      content: 'Hello from global',
      'x-promptg-time': { createdAt: new Date().toISOString() },
    };

    const tempGlobal = await makeTempStore('promptg-get-global-');
    const tempProject = await makeTempStore('promptg-get-project-');
    await storage.initializeDirectories(tempGlobal.store);
    await storage.initializeDirectories(tempProject.store);
    await storage.savePrompt(prompt, tempGlobal.store);

    const originalLoadPrompt = storage.loadPrompt;
    const loadPromptSpy = vi.spyOn(storage, 'loadPrompt').mockImplementation(async (n, opts) => {
      if (opts?.rootDir) return originalLoadPrompt(n, opts);
      return originalLoadPrompt(n, tempGlobal.store);
    });

    const out = captureWrites(process.stdout);
    await executeGet(services, name, {}, tempProject.store, {
      mode: 'auto',
      fallbackToGlobal: true,
      warnOnShadow: false,
    });

    expect(out.text().trim()).toBe('Hello from global');
    out.restore();

    loadPromptSpy.mockRestore();
    await cleanupTempStore(tempProject.tmpDir);
    await cleanupTempStore(tempGlobal.tmpDir);
  });
});
