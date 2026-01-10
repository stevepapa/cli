import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createCliServices } from '../src/cli/services.js';
import { executeGet } from '../src/cli/commands/get.js';
import { executeTemplateShow } from '../src/cli/commands/templateShow.js';
import { executePromptMeta } from '../src/cli/commands/promptMeta.js';
import { executePromptRename } from '../src/cli/commands/promptRename.js';
import { executeCreatePromptFromTemplate } from '../src/cli/commands/createPromptFromTemplate.js';
import { executeTemplateRm } from '../src/cli/commands/templateRm.js';
import { captureWrites } from './helpers/captureWrites.js';
import { cleanupTempStore, makeTempStore, type TempStore } from './helpers/tempStore.js';
import {
  getPromptsDir,
  getTemplatesDir,
  initializeDirectories,
  loadPrompt,
  promptExists,
  savePrompt,
} from '../src/node/storage/storage.js';
import { saveTemplate, templateExistsInStore } from '../src/node/storage/templates.js';
import type { Prompt, Template } from '../src/core/types/index.js';

describe('Headless Commands', () => {
  let temp: TempStore;
  const services = createCliServices();

  beforeEach(async () => {
    temp = await makeTempStore('promptg-headless-');
    await initializeDirectories(temp.store);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupTempStore(temp.tmpDir);
  });

  it('prompt meta updates displayName/description/tags', async () => {
    const name = `meta-${Date.now()}`;
    const prompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name,
      displayName: name,
      description: 'old',
      content: 'Hello',
      tags: ['keep'],
      'x-promptg-time': { createdAt: new Date().toISOString() },
    };
    await savePrompt(prompt, temp.store);

    await executePromptMeta(name, temp.store, {
      displayName: 'New Title',
      description: 'New Desc',
      tag: ['a', 'b', 'a'],
      removeTag: ['b'],
      quiet: true,
    });

    const out = captureWrites(process.stdout);
    await executeGet(services, name, { format: 'json' }, temp.store);
    const envelope = JSON.parse(out.text()) as { ok: boolean; data: any };
    out.restore();

    expect(envelope.ok).toBe(true);
    expect(envelope.data.title).toBe('New Title');
    expect(envelope.data.description).toBe('New Desc');
    expect(envelope.data.tags.sort()).toEqual(['a', 'keep'].sort());
  });

  it('prompt rename renames the prompt and updates displayName when it matches old name', async () => {
    const oldName = `old-${Date.now()}`;
    const newName = `new-${Date.now()}`;

    await savePrompt(
      {
        kind: 'prompt',
        schemaVersion: '1',
        name: oldName,
        displayName: oldName,
        content: 'X',
        'x-promptg-time': { createdAt: new Date().toISOString() },
      },
      temp.store
    );

    await executePromptRename(oldName, newName, temp.store, { quiet: true });

    expect(await promptExists(oldName, temp.store)).toBe(false);
    expect(await promptExists(newName, temp.store)).toBe(true);

    const renamed = await loadPrompt(newName, temp.store);
    expect(renamed.name).toBe(newName);
    expect(renamed.displayName).toBe(newName);
  });

  it('prompt new --from-template keeps raw content and seeds defaults', async () => {
    const templateName = `tmpl-${Date.now()}`;
    const promptName = `from-${Date.now()}`;

    const template: Template = {
      kind: 'template',
      schemaVersion: '1',
      name: templateName,
      displayName: templateName,
      description: 'Example template',
      prompt: {
        kind: 'prompt',
        schemaVersion: '1',
        name: templateName,
        content: 'Hello {{who}}',
        defaults: { who: 'world' },
      },
      'x-promptg-time': { createdAt: new Date().toISOString() },
    };
    await saveTemplate(template, temp.store);

    await executeCreatePromptFromTemplate(templateName, promptName, temp.store, 'project', {
      quiet: true,
    });

    const unfilledOut = captureWrites(process.stdout);
    await executeGet(services, promptName, { unfilled: true }, temp.store);
    expect(unfilledOut.text().trim()).toBe('Hello {{who}}');
    unfilledOut.restore();

    const filledOut = captureWrites(process.stdout);
    await executeGet(services, promptName, {}, temp.store);
    expect(filledOut.text().trim()).toBe('Hello world');
    filledOut.restore();
  });

  it('template rm removes an existing template', async () => {
    const templateName = `rm-${Date.now()}`;
    await saveTemplate(
      {
        kind: 'template',
        schemaVersion: '1',
        name: templateName,
        displayName: templateName,
        description: 'To delete',
        prompt: {
          kind: 'prompt',
          schemaVersion: '1',
          name: templateName,
          content: 'X',
        },
        'x-promptg-time': { createdAt: new Date().toISOString() },
      },
      temp.store
    );

    expect(await templateExistsInStore(templateName, temp.store)).toBe(true);
    await executeTemplateRm(templateName, temp.store, { quiet: true });
    expect(await templateExistsInStore(templateName, temp.store)).toBe(false);
  });

  it('get surfaces corrupt prompt JSON (does not treat as not found)', async () => {
    const name = `corrupt-${Date.now()}`;
    const filePath = path.join(getPromptsDir(temp.store), `promptg-prompt-${name}.json`);
    await fs.writeFile(filePath, '{ this is not json', 'utf8');

    await expect(executeGet(services, name, {}, temp.store)).rejects.toThrow(
      /Failed to load prompt/
    );
  });

  it('template show surfaces corrupt template JSON (does not treat as not found)', async () => {
    const name = `corrupt-tmpl-${Date.now()}`;
    const filePath = path.join(getTemplatesDir(temp.store), `promptg-template-${name}.json`);
    await fs.writeFile(filePath, '{ this is not json', 'utf8');

    await expect(
      executeTemplateShow({
        name,
        embedded: false,
        store: temp.store,
        mode: 'project',
        format: 'text',
      })
    ).rejects.toThrow(/Failed to load template/);
  });
});
