import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { getTemplatesDir, initializeDirectories } from '../src/node/storage/storage.js';
import { executeTemplateShow } from '../src/cli/commands/templateShow.js';
import type { Template } from '../src/core/types/index.js';
import { captureWrites } from './helpers/captureWrites.js';
import { cleanupTempStore, makeTempStore, type TempStore } from './helpers/tempStore.js';

describe('Template Show Command', () => {
  let temp: TempStore;

  beforeEach(async () => {
    temp = await makeTempStore('promptg-template-show-');
    await initializeDirectories(temp.store);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupTempStore(temp.tmpDir);
  });

  it('should show the embedded prompt JSON', async () => {
    const templateName = `test-template-show-${Date.now()}`;
    const templatePath = path.join(
      getTemplatesDir(temp.store),
      `promptg-template-${templateName}.json`
    );

    const template: Template & { $schema?: string } = {
      $schema: 'https://promptg.io/schemas/v1/template.schema.json',
      kind: 'template',
      schemaVersion: '1',
      name: templateName,
      displayName: 'Test Template',
      description: 'Test Template',
      prompt: {
        kind: 'prompt',
        schemaVersion: '1',
        name: templateName,
        content: 'X {{foo}}',
        defaults: { foo: 'bar' },
      },
    };

    await fs.writeFile(templatePath, JSON.stringify(template, null, 2), 'utf-8');

    const out = captureWrites(process.stdout);
    await executeTemplateShow({
      name: templateName,
      embedded: true,
      store: temp.store,
      mode: 'project',
      format: 'text',
    });
    const parsed = JSON.parse(out.text()) as { kind: string; defaults?: Record<string, string> };
    expect(parsed.kind).toBe('prompt');
    expect(parsed.defaults?.foo).toBe('bar');
    out.restore();

    await fs.unlink(templatePath).catch(() => {});
  });
});
