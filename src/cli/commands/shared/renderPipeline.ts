import { getStorageDir, type StorageOptions } from '../../../node/storage/storage.js';
import {
  extractVariables,
  substituteVariables,
  validateVariables,
} from '../../../core/lib/variables.js';
import { getChalk } from '../../cliKit.js';
import { RuntimeError, UsageError } from '../../errors.js';
import { writeJsonSuccess } from '../../output.js';
import type { CliServices } from '../../services.js';
import { askLine } from '../../interactive/askLine.js';
import { runInteractivePrompts } from './interactive.js';
import { printHeader } from './header.js';
import {
  extractInteractive,
  extractPrefilledVars,
  parseVariableOptions,
} from '../../../core/promptInputs.js';

export type StoreHintPolicy = {
  mode: 'auto' | 'project' | 'global';
  projectRoot?: string | null;
  fallbackToGlobal?: boolean;
  warnOnShadow?: boolean;
};

type RenderFormat = 'text' | 'json';
type ResolvedSource = 'project' | 'global';

function cyanStderr(text: string): string {
  const c = getChalk(process.stderr);
  return c.cyan(text);
}

function validateCommonOptions(params: {
  info: boolean;
  unfilled: boolean;
  interactive: boolean;
  format: RenderFormat;
}): void {
  if (params.info && params.unfilled) {
    throw new UsageError('Cannot combine --info and --unfilled');
  }

  if (params.format === 'json' && params.interactive) {
    throw new UsageError('Cannot combine --interactive with --format json');
  }
}

function buildStoreMeta(params: {
  resolvedSource: ResolvedSource;
  store?: StorageOptions;
  storeHints?: StoreHintPolicy;
}): {
  storeRoot: string;
  storeMode?: 'auto';
  didFallback: boolean;
  source: {
    store: ResolvedSource;
    rootDir: string;
    mode?: 'auto';
    didFallback: boolean;
  };
  storeLabel: string;
} {
  const storeMode = params.storeHints?.mode === 'auto' ? 'auto' : undefined;
  const storeRoot =
    params.resolvedSource === 'project' && params.store?.rootDir
      ? params.store.rootDir
      : getStorageDir();
  const didFallback =
    params.storeHints?.mode === 'auto' &&
    params.storeHints.fallbackToGlobal === true &&
    params.resolvedSource === 'global' &&
    !!params.store?.rootDir;

  const storeLabelParts = [
    params.resolvedSource === 'project' ? 'project' : 'global',
    storeMode ? `(${storeMode})` : undefined,
    didFallback ? '(fallback)' : undefined,
    storeRoot,
  ].filter(Boolean);

  return {
    storeRoot,
    storeMode,
    didFallback,
    source: {
      store: params.resolvedSource,
      rootDir: storeRoot,
      mode: storeMode,
      didFallback,
    },
    storeLabel: storeLabelParts.join(' '),
  };
}

async function copyIfRequested(services: CliServices, copy: boolean, text: string): Promise<void> {
  if (!copy) return;
  const ok = await services.clipboard.copyToClipboard(text);
  if (!ok) {
    throw new RuntimeError('Could not copy to clipboard on this system.');
  }
}

function buildVars(options: Record<string, unknown>, sourceData: unknown): Record<string, string> {
  const cliVars = parseVariableOptions(options);
  const prefilledVars = extractPrefilledVars(sourceData);
  return { ...prefilledVars, ...cliVars };
}

async function runInteractiveIfNeeded(params: {
  name: string;
  interactive: boolean;
  sourceData: unknown;
  vars: Record<string, string>;
}): Promise<void> {
  if (!params.interactive) return;
  if (!process.stderr.isTTY) {
    throw new UsageError('--interactive requires a TTY');
  }

  const interactiveMap = extractInteractive(params.sourceData);
  await runInteractivePrompts({
    promptName: params.name,
    vars: params.vars,
    interactiveMap,
    askLine,
    onSeparator: () => {
      process.stderr.write(`${cyanStderr('------------------------------')}\n\n`);
    },
  });
}

export async function executeGetLikeRender(params: {
  services: CliServices;
  kind: 'prompt' | 'template';
  name: string;
  sourceLabel: string;
  content: string;
  sourceData: unknown;
  title: string;
  descriptionText?: string;
  tags?: string[];
  resolvedSource: ResolvedSource;
  store?: StorageOptions;
  storeHints?: StoreHintPolicy;
  options: Record<string, unknown>;
}): Promise<void> {
  const info = params.options.info === true;
  const unfilled = params.options.unfilled === true;
  const interactive = params.options.interactive === true;
  const copy = params.options.copy === true;
  const format: RenderFormat = params.options.format === 'json' ? 'json' : 'text';

  validateCommonOptions({ info, unfilled, interactive, format });

  const storeMeta = buildStoreMeta({
    resolvedSource: params.resolvedSource,
    store: params.store,
    storeHints: params.storeHints,
  });

  const description = params.descriptionText ?? null;
  const tagsJson = params.tags ?? [];

  if (unfilled) {
    if (format === 'json') {
      writeJsonSuccess({
        kind: params.kind,
        name: params.name,
        title: params.title,
        description,
        tags: tagsJson,
        source: storeMeta.source,
        unfilled: true,
        template: params.content,
        variables: extractVariables(params.content),
      });
      return;
    }
    process.stdout.write(`${params.content}\n`);
    return;
  }

  const vars = buildVars(params.options, params.sourceData);
  await runInteractiveIfNeeded({
    name: params.name,
    interactive,
    sourceData: params.sourceData,
    vars,
  });

  const missingVarNames = validateVariables(params.content, vars);
  const text = substituteVariables(params.content, vars);
  const variableNames = extractVariables(params.content);
  const providedVarNames = Object.keys(vars).sort();

  if (format === 'json') {
    await copyIfRequested(params.services, copy, text);
    writeJsonSuccess({
      kind: params.kind,
      name: params.name,
      title: params.title,
      description,
      tags: tagsJson,
      source: storeMeta.source,
      template: params.content,
      text,
      variables: variableNames,
      providedVarNames,
      missingVarNames,
      copied: copy ? true : false,
    });
    return;
  }

  if (!info) {
    process.stdout.write(`${text}\n`);
    await copyIfRequested(params.services, copy, text);
    return;
  }

  printHeader({
    title: params.title,
    description: params.descriptionText,
    sourceLabel: params.sourceLabel,
    storeLabel: storeMeta.storeLabel,
    tags: params.tags,
    variableNames,
    providedVarNames,
    missingVarNames,
  });

  process.stdout.write(`${text}\n`);
  await copyIfRequested(params.services, copy, text);
}
