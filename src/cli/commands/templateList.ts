/**
 * Template List Command - List templates in the selected store.
 */

import type { StorageOptions } from '../../node/storage/storage.js';
import {
  loadTemplatesFromStoreWithDiagnostics,
  loadTemplatesWithDiagnostics,
} from '../../node/storage/templates.js';
import { extractVariables } from '../../core/lib/variables.js';
import { warn } from '../cliKit.js';
import { writeJsonSuccess } from '../output.js';

export async function executeTemplateList(
  store?: StorageOptions,
  format: 'text' | 'json' = 'text',
  options?: { filter?: string; long?: boolean }
): Promise<void> {
  const res = store?.rootDir
    ? await loadTemplatesFromStoreWithDiagnostics(store)
    : await loadTemplatesWithDiagnostics();
  const filterLower =
    typeof options?.filter === 'string' ? options.filter.toLowerCase().trim() : '';
  const templates =
    filterLower.length > 0
      ? res.templates.filter(t => {
          const haystack = [t.name, t.displayName, t.description, t.tags?.join(' ')]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(filterLower);
        })
      : res.templates;

  if (format === 'json') {
    const out = templates.map(t => ({
      name: t.name,
      displayName: t.displayName,
      description: t.description,
      tags: t.tags ?? [],
      variableCount: extractVariables(t.prompt.content).length,
    }));
    writeJsonSuccess(out);
    return;
  }

  if (res.invalidFiles > 0) {
    warn(
      `Ignored ${res.invalidFiles} invalid template file${res.invalidFiles === 1 ? '' : 's'}; run: promptg validate`
    );
  }

  if (templates.length === 0) {
    process.stdout.write('(no templates)\n');
    return;
  }

  if (options?.long === true) {
    for (const t of templates) {
      const vars = extractVariables(t.prompt.content);
      process.stdout.write(`${t.name}\n`);
      process.stdout.write(`  Display: ${t.displayName}\n`);
      process.stdout.write(`  Description: ${t.description}\n`);
      if (t.tags && t.tags.length > 0) process.stdout.write(`  Tags: ${t.tags.join(', ')}\n`);
      if (vars.length > 0) process.stdout.write(`  Vars: ${vars.join(', ')}\n`);
      if (t.prompt.defaults && Object.keys(t.prompt.defaults).length > 0) {
        process.stdout.write(`  Defaults: ${Object.keys(t.prompt.defaults).sort().join(', ')}\n`);
      }
      process.stdout.write('\n');
    }
    return;
  }

  const rows = templates.map(t => {
    const variableCount = extractVariables(t.prompt.content).length;
    return {
      name: t.name,
      vars: variableCount === 0 ? '' : `${variableCount} var${variableCount === 1 ? '' : 's'}`,
      description: t.description ?? '',
    };
  });

  const nameWidth = Math.max(...rows.map(r => r.name.length), 'NAME'.length);
  const varsWidth = Math.max(...rows.map(r => r.vars.length), 'VARS'.length);

  process.stdout.write(`${'NAME'.padEnd(nameWidth)}  ${'VARS'.padEnd(varsWidth)}  DESCRIPTION\n`);
  for (const r of rows) {
    process.stdout.write(
      `${r.name.padEnd(nameWidth)}  ${r.vars.padEnd(varsWidth)}  ${r.description}\n`
    );
  }
}
