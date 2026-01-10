import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  deletePrompt,
  getTemplatesDir,
  initializeDirectories,
  loadPrompt,
  promptExists,
} from '../src/node/storage/storage.js';
import { executeImport } from '../src/cli/commands/import.js';
import { cleanupTempStore, makeTempStore, type TempStore } from './helpers/tempStore.js';

describe('Import Command', () => {
  let temp: TempStore;

  beforeEach(async () => {
    temp = await makeTempStore('promptg-import-store-');
    await initializeDirectories(temp.store);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports a prompt from a JSON file', async () => {
    const name = `import-test-prompt-${Date.now()}`.replace(/_/g, '-');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptg-import-'));
    const filePath = path.join(tmpDir, 'prompt.json');

    await fs.writeFile(
      filePath,
      JSON.stringify(
        {
          kind: 'prompt',
          schemaVersion: '1',
          name,
          content: 'Hello {{name}}',
          defaults: { name: 'Alice' },
        },
        null,
        2
      ),
      'utf8'
    );

    await executeImport(filePath, { quiet: true }, temp.store);

    const loaded = await loadPrompt(name, temp.store);
    expect(loaded.name).toBe(name);
    expect(loaded.content).toBe('Hello {{name}}');
    expect(loaded.defaults?.name).toBe('Alice');

    if (await promptExists(name, temp.store)) await deletePrompt(name, temp.store);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('imports a template from a JSON file', async () => {
    const name = `import-test-template-${Date.now()}`.replace(/_/g, '-');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptg-import-'));
    const filePath = path.join(tmpDir, 'template.json');

    await fs.writeFile(
      filePath,
      JSON.stringify(
        {
          kind: 'template',
          schemaVersion: '1',
          name,
          displayName: 'Import Test Template',
          description: 'Import Test Template',
          prompt: {
            kind: 'prompt',
            schemaVersion: '1',
            name,
            content: 'X {{foo}}',
            defaults: { foo: 'bar' },
          },
        },
        null,
        2
      ),
      'utf8'
    );

    await executeImport(filePath, { quiet: true }, temp.store);

    const outPath = path.join(getTemplatesDir(temp.store), `promptg-template-${name}.json`);
    const saved = JSON.parse(await fs.readFile(outPath, 'utf8')) as {
      name: string;
      $schema?: string;
    };
    expect(saved.name).toBe(name);
    expect(typeof saved.$schema).toBe('string');

    await fs.unlink(outPath).catch(() => {});
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('rejects template import without description', async () => {
    const name = `import-test-template-nodesc-${Date.now()}`.replace(/_/g, '-');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptg-import-'));
    const filePath = path.join(tmpDir, 'template.json');

    await fs.writeFile(
      filePath,
      JSON.stringify(
        {
          kind: 'template',
          schemaVersion: '1',
          name,
          displayName: 'Import Test Template (No Desc)',
          prompt: {
            kind: 'prompt',
            schemaVersion: '1',
            name,
            content: 'X {{foo}}',
          },
        },
        null,
        2
      ),
      'utf8'
    );

    await expect(executeImport(filePath, { quiet: true }, temp.store)).rejects.toThrow(
      /description/i
    );
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await cleanupTempStore(temp.tmpDir);
  });
});
