/**
 * Save Command - Save custom prompts from stdin
 */

import {
  loadPrompt,
  promptExists,
  savePrompt,
  type StorageOptions,
} from '../../node/storage/storage.js';
import { extractVariables } from '../../core/lib/variables.js';
import { toErrorMessage } from '../../core/lib/errors.js';
import { isKebabCaseName } from '../../core/lib/names.js';
import { Prompt } from '../../core/types/index.js';
import { status } from '../cliKit.js';
import { RuntimeError, UsageError, ValidationError } from '../errors.js';
import { PROMPT_SCHEMA_VERSION, X_PROMPTG_TIME } from '../../core/spec.js';

/**
 * Read from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    process.stdin.on('data', chunk => {
      chunks.push(chunk);
    });

    process.stdin.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8').trim());
    });

    process.stdin.on('error', error => {
      reject(error);
    });

    // Handle case where stdin is a TTY (no piped input)
    if (process.stdin.isTTY) {
      reject(
        new UsageError(
          'No input provided. Pipe content to save: echo "Your prompt" | promptg prompt save <name>'
        )
      );
    }
  });
}

/**
 * Validate prompt name (must be kebab-case)
 */
function validatePromptName(name: string): string | null {
  if (!isKebabCaseName(name)) {
    return 'Invalid prompt name. Use kebab-case (lowercase with hyphens):\n  Examples: code-review, my-prompt, security-check-v2';
  }

  return null;
}

/**
 * Execute the save command
 */
export async function executeSave(
  name: string,
  store?: StorageOptions,
  options?: { quiet?: boolean }
): Promise<void> {
  const quiet = options?.quiet === true;
  const log = (msg: string) => {
    if (!quiet) status(msg);
  };

  // Validate name
  const validationError = validatePromptName(name);
  if (validationError) {
    throw new UsageError(validationError);
  }

  const content = await readStdin();

  // Validate content
  if (!content || content.length === 0) {
    throw new ValidationError('Cannot save empty prompt.');
  }

  // Check if prompt already exists
  const exists = await promptExists(name, store);
  let existingCreatedAt: string | undefined;

  if (exists) {
    log(`Overwriting existing prompt "${name}".`);
    const existing = await loadPrompt(name, store);
    existingCreatedAt = existing[X_PROMPTG_TIME]?.createdAt;
  }

  // Extract variables from content
  const variables = extractVariables(content);

  // Create prompt object
  const prompt: Prompt = {
    kind: 'prompt',
    schemaVersion: PROMPT_SCHEMA_VERSION,
    name,
    displayName: name,
    content,
    [X_PROMPTG_TIME]: {
      createdAt: existingCreatedAt ?? new Date().toISOString(),
    },
  };

  try {
    await savePrompt(prompt, store);
  } catch (e) {
    throw new RuntimeError(`Failed to save prompt: ${toErrorMessage(e)}`);
  }

  log(`Saved prompt "${name}".`);
  if (variables.length > 0) {
    log(`Variables: ${variables.join(', ')}`);
  }
}
