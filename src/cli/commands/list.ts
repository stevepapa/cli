/**
 * Prompt List Command - List prompts in the selected store.
 */

import { listPromptsWithDiagnostics, type StorageOptions } from '../../node/storage/storage.js';
import { formatTimeAgo } from '../../core/lib/time.js';
import { extractVariables } from '../../core/lib/variables.js';
import { warn } from '../cliKit.js';
import { writeJsonSuccess } from '../output.js';

export async function executeList(
  store?: StorageOptions,
  _mode: 'auto' | 'project' | 'global' = 'auto',
  format: 'text' | 'json' = 'text',
  options?: { filter?: string; long?: boolean }
): Promise<void> {
  const res = await listPromptsWithDiagnostics(store);
  const filterLower =
    typeof options?.filter === 'string' ? options.filter.toLowerCase().trim() : '';
  const prompts =
    filterLower.length > 0
      ? res.prompts.filter(p => {
          const haystack = [p.name, p.displayName, p.description, p.tags?.join(' ')]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(filterLower);
        })
      : res.prompts;

  if (format === 'json') {
    const out = prompts.map(p => ({
      name: p.name,
      displayName: p.displayName ?? p.name,
      description: p.description ?? null,
      tags: p.tags ?? [],
      createdAt: p['x-promptg-time']?.createdAt ?? null,
      variableCount: extractVariables(p.content).length,
    }));
    writeJsonSuccess(out);
    return;
  }

  if (res.invalidFiles > 0) {
    warn(
      `Ignored ${res.invalidFiles} invalid prompt file${res.invalidFiles === 1 ? '' : 's'}; run: promptg validate`
    );
  }

  if (prompts.length === 0) {
    process.stdout.write('(no prompts)\n');
    return;
  }

  if (options?.long === true) {
    for (const p of prompts) {
      const vars = extractVariables(p.content);
      process.stdout.write(`${p.name}\n`);
      if (p.displayName && p.displayName !== p.name) {
        process.stdout.write(`  Display: ${p.displayName}\n`);
      }
      if (p.description) process.stdout.write(`  Description: ${p.description}\n`);
      if (p.tags && p.tags.length > 0) process.stdout.write(`  Tags: ${p.tags.join(', ')}\n`);
      if (vars.length > 0) process.stdout.write(`  Vars: ${vars.join(', ')}\n`);
      if (p.defaults && Object.keys(p.defaults).length > 0) {
        process.stdout.write(`  Defaults: ${Object.keys(p.defaults).sort().join(', ')}\n`);
      }
      process.stdout.write('\n');
    }
    return;
  }

  const rows = prompts.map(p => {
    const t = p['x-promptg-time'];
    const createdAt = typeof t?.createdAt === 'string' ? Date.parse(t.createdAt) : NaN;
    const created = Number.isFinite(createdAt) ? formatTimeAgo(createdAt) : '-';
    const variableCount = extractVariables(p.content).length;
    return {
      name: p.name,
      vars: variableCount === 0 ? '' : `${variableCount} var${variableCount === 1 ? '' : 's'}`,
      created,
    };
  });

  const nameWidth = Math.max(...rows.map(r => r.name.length), 'NAME'.length);
  const varsWidth = Math.max(...rows.map(r => r.vars.length), 'VARS'.length);

  process.stdout.write(`${'NAME'.padEnd(nameWidth)}  ${'VARS'.padEnd(varsWidth)}  CREATED\n`);
  for (const r of rows) {
    process.stdout.write(
      `${r.name.padEnd(nameWidth)}  ${r.vars.padEnd(varsWidth)}  ${r.created}\n`
    );
  }
}
