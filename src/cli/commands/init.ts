/**
 * Init Command - Creates a project-local `.promptg/` folder structure.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { status } from '../cliKit.js';
import { RuntimeError } from '../errors.js';
import { toErrorMessage } from '../../core/lib/errors.js';

export async function executeInit(
  cwd: string,
  options?: { quiet?: boolean }
): Promise<{ rootDir: string; created: boolean }> {
  const root = path.join(cwd, '.promptg');
  const promptsDir = path.join(root, 'prompts');
  const templatesDir = path.join(root, 'templates');
  const packsDir = path.join(root, 'packs');

  const quiet = options?.quiet === true;
  const log = (msg: string) => {
    if (!quiet) status(msg);
  };

  try {
    const stat = await fs.stat(root);
    if (stat.isDirectory()) {
      log('PromptG repository already initialized.');
      log(`Found: ${root}`);
      return { rootDir: root, created: false };
    }
  } catch {
    // not found; proceed to create
  }

  try {
    await fs.mkdir(promptsDir, { recursive: true });
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.mkdir(packsDir, { recursive: true });
  } catch (e) {
    throw new RuntimeError(`Failed to initialize .promptg: ${toErrorMessage(e)}`);
  }

  log(`Initialized empty PromptG repository in ${root}`);
  log('Next:');
  log('  - Use `promptg --help` to see CLI commands');
  log(
    '  - Create prompts with `promptg prompt new <name>` or pipe with `promptg prompt save <name>`'
  );
  log('  - Create templates with `promptg template new <name>`');

  return { rootDir: root, created: true };
}
