/**
 * Prompt Pack Tests
 */

import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildPromptPack, installPromptPack, normalizePromptPack } from '../src/node/packs/pack.js';
import {
  getPromptsDir,
  getTemplatesDir,
  getPacksDir,
  initializeDirectories,
  loadPrompt,
  savePrompt,
  type StorageOptions,
} from '../src/node/storage/storage.js';
import type { Prompt, Template } from '../src/core/types/index.js';

async function makeTempStore(): Promise<{ store: StorageOptions; rootDir: string }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptg-pack-'));
  const rootDir = path.join(tmpDir, '.promptg');
  await fs.mkdir(rootDir, { recursive: true });
  return { store: { rootDir }, rootDir };
}

describe('Prompt Packs', () => {
  it('validates pack schemaVersion/name/version', async () => {
    const bad = normalizePromptPack({ name: 'x', version: '1.0.0', prompts: [] });
    expect(bad.ok).toBe(false);

    const ok = normalizePromptPack({
      kind: 'pack',
      schemaVersion: '1',
      name: 'starter-pack',
      version: '1.2.3',
      prompts: [
        {
          kind: 'prompt',
          schemaVersion: '1',
          name: 'a',
          content: 'x',
          'x-promptg-time': { createdAt: new Date().toISOString() },
        },
      ],
    });
    expect(ok.ok).toBe(true);
  });

  it('fails all-or-nothing on conflicts by default', async () => {
    const { store, rootDir } = await makeTempStore();
    await initializeDirectories(store);

    const existingPrompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name: 'existing-prompt',
      content: 'Old prompt',
      'x-promptg-time': { createdAt: new Date(123).toISOString() },
    };
    await savePrompt(existingPrompt, store);

    const existingTemplatePath = path.join(
      getTemplatesDir(store),
      'promptg-template-existing-template.json'
    );
    const existingTemplate: Template = {
      kind: 'template',
      schemaVersion: '1',
      name: 'existing-template',
      displayName: 'Existing',
      description: 'Existing',
      prompt: {
        kind: 'prompt',
        schemaVersion: '1',
        name: 'existing-template',
        content: 'Old {{x}}',
      },
    };
    await fs.writeFile(existingTemplatePath, JSON.stringify(existingTemplate, null, 2), 'utf8');

    const pack = normalizePromptPack({
      kind: 'pack',
      schemaVersion: '1',
      name: 'my-pack',
      version: '1.0.0',
      prompts: [
        {
          kind: 'prompt',
          schemaVersion: '1',
          name: 'existing-prompt',
          content: 'New prompt',
          'x-promptg-time': { createdAt: new Date().toISOString() },
        },
        {
          kind: 'prompt',
          schemaVersion: '1',
          name: 'new-prompt',
          content: 'Hello',
          'x-promptg-time': { createdAt: new Date().toISOString() },
        },
      ],
      templates: [
        {
          kind: 'template',
          schemaVersion: '1',
          name: 'existing-template',
          displayName: 'Existing',
          description: 'Existing',
          prompt: {
            kind: 'prompt',
            schemaVersion: '1',
            name: 'existing-template',
            content: 'New {{x}}',
          },
        },
        {
          kind: 'template',
          schemaVersion: '1',
          name: 'new-template',
          displayName: 'New',
          description: 'New',
          prompt: {
            kind: 'prompt',
            schemaVersion: '1',
            name: 'new-template',
            content: 'X {{y}}',
          },
        },
      ],
    });
    expect(pack.ok).toBe(true);
    if (!pack.ok) throw new Error(pack.error);

    await expect(
      installPromptPack({ pack: pack.value, store, force: false, onlyNew: false })
    ).rejects.toThrow(/already exist/i);

    // No partial writes should occur.
    const newPromptPath = path.join(getPromptsDir(store), 'promptg-prompt-new-prompt.json');
    const newTemplatePath = path.join(getTemplatesDir(store), 'promptg-template-new-template.json');
    await expect(fs.access(newPromptPath)).rejects.toThrow();
    await expect(fs.access(newTemplatePath)).rejects.toThrow();

    await fs.rm(path.dirname(rootDir), { recursive: true, force: true });
  });

  it('supports --only-new (skip conflicts) and --force (overwrite)', async () => {
    const { store, rootDir } = await makeTempStore();
    await initializeDirectories(store);

    const baselineCreatedAt = new Date(123).toISOString();
    const existingPrompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name: 'existing-prompt',
      content: 'Old prompt',
      'x-promptg-time': { createdAt: baselineCreatedAt },
    };
    await savePrompt(existingPrompt, store);

    const existingTemplatePath = path.join(
      getTemplatesDir(store),
      'promptg-template-existing-template.json'
    );
    await fs.writeFile(
      existingTemplatePath,
      JSON.stringify(
        {
          kind: 'template',
          schemaVersion: '1',
          name: 'existing-template',
          displayName: 'Existing',
          description: 'Existing',
          prompt: {
            kind: 'prompt',
            schemaVersion: '1',
            name: 'existing-template',
            content: 'Old {{x}}',
          },
        } satisfies Template,
        null,
        2
      ),
      'utf8'
    );

    const pack = normalizePromptPack({
      kind: 'pack',
      schemaVersion: '1',
      name: 'my-pack',
      version: '1.0.0',
      prompts: [
        {
          kind: 'prompt',
          schemaVersion: '1',
          name: 'existing-prompt',
          content: 'New prompt',
          'x-promptg-time': { createdAt: new Date().toISOString() },
        },
        {
          kind: 'prompt',
          schemaVersion: '1',
          name: 'new-prompt',
          content: 'Hello',
          'x-promptg-time': { createdAt: new Date().toISOString() },
        },
      ],
      templates: [
        {
          kind: 'template',
          schemaVersion: '1',
          name: 'existing-template',
          displayName: 'Existing',
          description: 'Existing',
          prompt: {
            kind: 'prompt',
            schemaVersion: '1',
            name: 'existing-template',
            content: 'New {{x}}',
          },
        },
        {
          kind: 'template',
          schemaVersion: '1',
          name: 'new-template',
          displayName: 'New',
          description: 'New',
          prompt: {
            kind: 'prompt',
            schemaVersion: '1',
            name: 'new-template',
            content: 'X {{y}}',
          },
        },
      ],
    });
    expect(pack.ok).toBe(true);
    if (!pack.ok) throw new Error(pack.error);

    const onlyNewRes = await installPromptPack({
      pack: pack.value,
      store,
      force: false,
      onlyNew: true,
    });
    expect(onlyNewRes.skippedPrompts).toContain('existing-prompt');
    expect(onlyNewRes.skippedTemplates).toContain('existing-template');
    expect(onlyNewRes.installedPrompts).toContain('new-prompt');
    expect(onlyNewRes.installedTemplates).toContain('new-template');

    const forceRes = await installPromptPack({
      pack: pack.value,
      store,
      force: true,
      onlyNew: false,
    });
    expect(forceRes.installedPrompts).toContain('existing-prompt');
    expect(forceRes.installedTemplates).toContain('existing-template');

    const loaded = await loadPrompt('existing-prompt', store);
    expect(loaded['x-promptg-time']?.createdAt).toBe(baselineCreatedAt);
    expect(loaded.content).toBe('New prompt');

    const updatedTemplate = JSON.parse(await fs.readFile(existingTemplatePath, 'utf8')) as Template;
    expect(updatedTemplate.prompt.content).toBe('New {{x}}');
    expect('id' in (updatedTemplate as unknown as Record<string, unknown>)).toBe(false);

    await fs.rm(path.dirname(rootDir), { recursive: true, force: true });
  });

  it('builds a pack file into the packs folder', async () => {
    const { store, rootDir } = await makeTempStore();
    await initializeDirectories(store);

    await savePrompt(
      {
        kind: 'prompt',
        schemaVersion: '1',
        name: 'pack-build-prompt',
        content: 'Hello',
        'x-promptg-time': { createdAt: new Date().toISOString() },
      },
      store
    );

    await fs.writeFile(
      path.join(getTemplatesDir(store), 'promptg-template-pack-build-template.json'),
      JSON.stringify(
        {
          kind: 'template',
          schemaVersion: '1',
          name: 'pack-build-template',
          displayName: 'Pack Build Template',
          description: 'Pack Build Template',
          prompt: {
            kind: 'prompt',
            schemaVersion: '1',
            name: 'pack-build-template',
            content: 'X {{foo}}',
          },
        } satisfies Template,
        null,
        2
      ),
      'utf8'
    );

    const { filePath, pack } = await buildPromptPack({
      name: 'built-pack',
      version: '1.0.0',
      store,
      force: true,
    });

    expect(filePath).toContain(getPacksDir(store));
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8')) as {
      kind: string;
      schemaVersion: string;
      name: string;
      version: string;
    };
    expect(raw.kind).toBe('pack');
    expect(raw.schemaVersion).toBe('1');
    expect(raw.name).toBe('built-pack');
    expect(raw.version).toBe('1.0.0');
    expect(pack.name).toBe('built-pack');
    expect(JSON.stringify(raw)).not.toContain('sourcePack');

    await fs.rm(path.dirname(rootDir), { recursive: true, force: true });
  });
});
