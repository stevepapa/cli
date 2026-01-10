import type { StorageOptions } from '../../node/storage/storage.js';
import { loadPrompt, promptExists, savePrompt } from '../../node/storage/storage.js';
import { loadTemplate, loadTemplateFromStore } from '../../node/storage/templates.js';
import { isStorageNotFoundError } from '../../node/storage/errors.js';
import type { Prompt, Template } from '../../core/types/index.js';
import { validateVariables } from '../../core/lib/variables.js';
import { validateKebabCaseName } from '../../core/lib/names.js';
import { getChalk, status } from '../cliKit.js';
import { UsageError, ValidationError } from '../errors.js';
import { PROMPT_SCHEMA_VERSION, X_PROMPTG_TIME } from '../../core/spec.js';
import { extractInteractive, parseVariableOptions } from '../../core/promptInputs.js';
import { runInteractivePrompts } from './shared/interactive.js';
import { askLine } from '../interactive/askLine.js';

type ResolvedSource = 'project' | 'global';

function cyanStderr(text: string): string {
  const c = getChalk(process.stderr);
  return c.cyan(text);
}

function deepCopyJson<T>(value: T): T {
  // Node 20+ supports structuredClone; fall back to JSON copy if needed.
  if (typeof structuredClone === 'function') return structuredClone(value) as T;
  return JSON.parse(JSON.stringify(value)) as T;
}

async function loadTemplateWithAutoFallback(params: {
  name: string;
  store: StorageOptions | undefined;
  mode: 'auto' | 'project' | 'global';
}): Promise<{ template: Template; resolvedSource: ResolvedSource }> {
  const hasProject = !!params.store?.rootDir;

  if (!hasProject) {
    return { template: await loadTemplate(params.name), resolvedSource: 'global' };
  }

  try {
    return {
      template: await loadTemplateFromStore(params.name, params.store),
      resolvedSource: 'project',
    };
  } catch (error) {
    if (params.mode === 'auto' && isStorageNotFoundError(error, 'template')) {
      return { template: await loadTemplate(params.name), resolvedSource: 'global' };
    }
    if (!isStorageNotFoundError(error, 'template')) throw error;
    throw new ValidationError(`Template "${params.name}" not found.`, {
      hints: ['Try: promptg template list'],
    });
  }
}

export async function executeCreatePromptFromTemplate(
  templateName: string,
  promptName: string,
  store: StorageOptions | undefined,
  mode: 'auto' | 'project' | 'global',
  options: Record<string, unknown>
): Promise<void> {
  const quiet = options.quiet === true;
  const log = (msg: string) => {
    if (!quiet) status(msg);
  };

  const force = options.force === true;
  const interactive = options.interactive === true;

  const templateNameErr = validateKebabCaseName(templateName);
  if (templateNameErr) throw new UsageError(templateNameErr);
  const promptNameErr = validateKebabCaseName(promptName);
  if (promptNameErr) throw new UsageError(promptNameErr);

  const promptAlreadyExists = await promptExists(promptName, store);
  let existingCreatedAt: string | undefined;
  if (promptAlreadyExists) {
    if (!force) {
      throw new ValidationError(`Prompt "${promptName}" already exists. Use --force to overwrite.`);
    }
    const existing = await loadPrompt(promptName, store);
    existingCreatedAt = existing[X_PROMPTG_TIME]?.createdAt;
  }

  const { template, resolvedSource } = await loadTemplateWithAutoFallback({
    name: templateName,
    store,
    mode,
  });

  if (store?.rootDir && mode === 'auto' && resolvedSource === 'global') {
    log(
      `Using global template "${templateName}" (not found in project store). Prompt will be created in the project store.`
    );
  }

  // Step 1: Pure instantiation (deep copy of embedded prompt only).
  const createdAt = existingCreatedAt ?? new Date().toISOString();
  const instantiated: Prompt = deepCopyJson(template.prompt);
  const prompt: Prompt = {
    ...instantiated,
    kind: 'prompt',
    schemaVersion: PROMPT_SCHEMA_VERSION,
    name: promptName,
    [X_PROMPTG_TIME]: { createdAt },
  };

  // Step 2: Optional CLI customization (store defaults on the created prompt).
  const cliVars = parseVariableOptions(options);
  const hasCustomization = Object.keys(cliVars).length > 0 || interactive;

  if (hasCustomization) {
    const customDefaults: Record<string, string> = { ...(prompt.defaults ?? {}), ...cliVars };

    if (interactive) {
      if (!process.stderr.isTTY) throw new UsageError('--interactive requires a TTY');

      const interactiveMap = extractInteractive(prompt);
      await runInteractivePrompts({
        promptName: templateName,
        vars: customDefaults,
        interactiveMap,
        askLine,
        onSeparator: () => {
          process.stderr.write(`${cyanStderr('------------------------------')}\n\n`);
        },
      });

      const missing = validateVariables(prompt.content, customDefaults);
      for (const varName of missing) {
        const value = await askLine({
          question: `Value for "${varName}" (leave empty to keep placeholder)`,
          defaultValue: customDefaults[varName],
          required: false,
        });
        if (value.trim().length === 0) {
          delete customDefaults[varName];
        } else {
          customDefaults[varName] = value;
        }
      }
    }

    prompt.defaults = Object.keys(customDefaults).length > 0 ? customDefaults : undefined;
  }

  await savePrompt(prompt, store);
  log(`Created prompt "${promptName}" from template "${templateName}".`);
}
