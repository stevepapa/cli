import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Prompt } from '../src/core/types/index.js';
import * as storage from '../src/node/storage/storage.js';
import { executePromptEdit } from '../src/cli/commands/promptEdit.js';
import { cleanupTempStore, makeTempStore, type TempStore } from './helpers/tempStore.js';

let nextEditOutput: string | null = null;

vi.mock('@inquirer/external-editor', () => {
  return {
    edit: (text: string) => {
      if (nextEditOutput === null) return text;
      return nextEditOutput;
    },
  };
});

describe('Prompt Edit (raw JSON)', () => {
  let temp: TempStore;

  beforeEach(async () => {
    nextEditOutput = null;
    temp = await makeTempStore('promptg-prompt-edit-raw-');
    await storage.initializeDirectories(temp.store);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupTempStore(temp.tmpDir);
  });

  it('edits full prompt JSON when --raw is used', async () => {
    const name = `test-prompt-edit-raw-${Date.now()}`;
    const createdAt = new Date().toISOString();

    const prompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name,
      displayName: 'Original',
      description: 'Original description',
      content: 'Hello {{name}}',
      defaults: { name: 'Alice' },
      tags: ['test'],
      'x-promptg-time': { createdAt },
    };

    await storage.savePrompt(prompt, temp.store);

    nextEditOutput = JSON.stringify(
      {
        $schema: 'https://promptg.io/schemas/v1/prompt.schema.json',
        ...prompt,
        displayName: 'Updated',
        description: 'Updated description',
        defaults: { name: 'Bob' },
      },
      null,
      2
    );

    await executePromptEdit(name, temp.store, { quiet: true, raw: true });

    const updated = await storage.loadPrompt(name, temp.store);
    expect(updated.displayName).toBe('Updated');
    expect(updated.description).toBe('Updated description');
    expect(updated.defaults).toEqual({ name: 'Bob' });
    expect(updated['x-promptg-time']?.createdAt).toBe(createdAt);
  });

  it('rejects changing the prompt name in raw editor mode', async () => {
    const name = `test-prompt-edit-raw-rename-${Date.now()}`;

    const prompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name,
      content: 'Hello',
      'x-promptg-time': { createdAt: new Date().toISOString() },
    };

    await storage.savePrompt(prompt, temp.store);

    nextEditOutput = JSON.stringify({ ...prompt, name: `${name}-new` }, null, 2);

    await expect(executePromptEdit(name, temp.store, { quiet: true, raw: true })).rejects.toThrow(
      'Cannot change prompt "name"'
    );
  });
});
