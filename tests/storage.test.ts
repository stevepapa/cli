import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  initializeDirectories,
  savePrompt,
  loadPrompt,
  listPrompts,
  promptExists,
  deletePrompt,
  getPromptsDir,
  getStorageStats,
} from '../src/node/storage/storage.js';
import { Prompt } from '../src/core/types/index.js';
import { cleanupTempStore, makeTempStore, type TempStore } from './helpers/tempStore.js';

describe('Storage Layer', () => {
  let temp: TempStore;

  beforeEach(async () => {
    temp = await makeTempStore('promptg-storage-');
  });

  afterEach(async () => {
    await cleanupTempStore(temp.tmpDir);
  });

  describe('Directory Initialization', () => {
    it('should create storage directories', async () => {
      await initializeDirectories(temp.store);

      const promptsDir = getPromptsDir(temp.store);

      const promptsDirExists = await fs
        .access(promptsDir)
        .then(() => true)
        .catch(() => false);

      expect(promptsDirExists).toBe(true);
    });

    it('should not error if directories already exist', async () => {
      await initializeDirectories(temp.store);
      await expect(initializeDirectories(temp.store)).resolves.not.toThrow();
    });
  });

  describe('Prompt CRUD Operations', () => {
    const testPrompt: Prompt = {
      kind: 'prompt',
      schemaVersion: '1',
      name: 'test-prompt-' + Date.now(),
      content: 'Review {{language}} code for {{focus}} issues',
      tags: ['code-review'],
      'x-promptg-time': { createdAt: new Date().toISOString() },
    };

    afterEach(async () => {
      // Clean up test prompts
      try {
        if (await promptExists(testPrompt.name, temp.store)) {
          await deletePrompt(testPrompt.name, temp.store);
        }
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should save a prompt', async () => {
      await savePrompt(testPrompt, temp.store);

      const filePath = path.join(
        getPromptsDir(temp.store),
        `promptg-prompt-${testPrompt.name}.json`
      );
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });

    it('should load a saved prompt', async () => {
      await savePrompt(testPrompt, temp.store);
      const loaded = await loadPrompt(testPrompt.name, temp.store);

      expect(loaded.name).toBe(testPrompt.name);
      expect(loaded.content).toBe(testPrompt.content);
      expect(loaded.tags).toEqual(testPrompt.tags);
    });

    it('should throw error when loading non-existent prompt', async () => {
      await expect(loadPrompt('nonexistent-999999', temp.store)).rejects.toThrow('not found');
    });

    it('should check if prompt exists', async () => {
      expect(await promptExists(testPrompt.name, temp.store)).toBe(false);

      await savePrompt(testPrompt, temp.store);

      expect(await promptExists(testPrompt.name, temp.store)).toBe(true);
    });

    it('should delete a prompt', async () => {
      await savePrompt(testPrompt, temp.store);
      expect(await promptExists(testPrompt.name, temp.store)).toBe(true);

      await deletePrompt(testPrompt.name, temp.store);
      expect(await promptExists(testPrompt.name, temp.store)).toBe(false);
    });

    it('should throw error when deleting non-existent prompt', async () => {
      await expect(deletePrompt('nonexistent-999999', temp.store)).rejects.toThrow('not found');
    });

    it('should list all prompts', async () => {
      const prompt1: Prompt = {
        kind: 'prompt',
        schemaVersion: '1',
        name: 'test-list-1-' + Date.now(),
        content: 'First prompt',
        'x-promptg-time': { createdAt: new Date().toISOString() },
      };

      const prompt2: Prompt = {
        kind: 'prompt',
        schemaVersion: '1',
        name: 'test-list-2-' + Date.now(),
        content: 'Second prompt',
        'x-promptg-time': { createdAt: new Date(Date.now() + 1000).toISOString() },
      };

      await savePrompt(prompt1, temp.store);
      await savePrompt(prompt2, temp.store);

      const prompts = await listPrompts(temp.store);

      expect(prompts.length).toBeGreaterThanOrEqual(2);
      expect(prompts.map(p => p.name)).toContain(prompt1.name);
      expect(prompts.map(p => p.name)).toContain(prompt2.name);

      // Cleanup
      await deletePrompt(prompt1.name, temp.store);
      await deletePrompt(prompt2.name, temp.store);
    });

    it('should sort prompts by most recent first', async () => {
      const oldPrompt: Prompt = {
        kind: 'prompt',
        schemaVersion: '1',
        name: 'test-old-' + Date.now(),
        content: 'Old',
        'x-promptg-time': { createdAt: new Date(Date.now() - 10000).toISOString() },
      };

      const newPrompt: Prompt = {
        kind: 'prompt',
        schemaVersion: '1',
        name: 'test-new-' + Date.now(),
        content: 'New',
        'x-promptg-time': { createdAt: new Date().toISOString() },
      };

      await savePrompt(oldPrompt, temp.store);
      await savePrompt(newPrompt, temp.store);

      const prompts = await listPrompts(temp.store);
      const oldIndex = prompts.findIndex(p => p.name === oldPrompt.name);
      const newIndex = prompts.findIndex(p => p.name === newPrompt.name);

      expect(newIndex).toBeLessThan(oldIndex);

      // Cleanup
      await deletePrompt(oldPrompt.name, temp.store);
      await deletePrompt(newPrompt.name, temp.store);
    });
  });

  describe('Storage Statistics', () => {
    it('should return storage stats', async () => {
      const stats = await getStorageStats(temp.store);

      expect(stats.promptCount).toBeGreaterThanOrEqual(0);
      expect(stats.templateCount).toBeGreaterThanOrEqual(0);
      expect(stats.storageDir).toContain('.promptg');
      expect(stats.promptsDir).toContain('prompts');
      expect(stats.templatesDir).toContain('templates');
    });
  });
});
