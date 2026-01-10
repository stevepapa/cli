import type { Command } from 'commander';
import { resolveStoreFromOptions } from '../cliKit.js';
import { writeJsonSuccess } from '../output.js';

export function registerPackCommands(program: Command): void {
  const pack = program.command('pack').description('Prompt pack commands');

  pack
    .command('install <source>')
    .description('Install a prompt pack (file path or URL)')
    .option('-f, --force', 'Overwrite existing prompts/templates')
    .option('--only-new', 'Skip prompts/templates that already exist')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Notes:',
        '  - Packs are a single JSON file containing prompts and/or templates.',
        '  - By default, install fails if any items already exist (all-or-nothing).',
        '  - Use --force to overwrite, or --only-new to skip existing items.',
        '',
        'Examples:',
        '  promptg pack install ./promptg-pack-starter.json',
        '  promptg pack install https://example.com/promptg-pack-starter.json',
        '  promptg pack install ./pack.json --store project',
        '  promptg pack install ./pack.json --only-new',
        '  promptg pack install ./pack.json --force',
        '',
      ].join('\n')
    )
    .action(async (source: string, options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as {
        format?: unknown;
        json?: unknown;
        quiet?: unknown;
      };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';
      const quiet = globals.quiet === true || format === 'json';

      const { store } = await resolveStoreFromOptions(options);
      const { executePackInstall } = await import('../commands/packInstall.js');
      const res = await executePackInstall(source, { ...options, quiet }, store);
      if (format === 'json') {
        writeJsonSuccess(res);
      }
    });

  pack
    .command('build <name>')
    .description('Build a prompt pack from the selected store')
    .requiredOption('--pack-version <semver>', 'Pack version (semver)')
    .option('-f, --force', 'Overwrite if the pack file already exists')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Output:',
        '  - Writes to <store>/packs/promptg-pack-<name>.json',
        '',
        'Examples:',
        '  promptg pack build my-team --pack-version 1.0.0',
        '  promptg pack build my-team --pack-version 1.0.0',
        '',
      ].join('\n')
    )
    .action(async (name: string, options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as {
        format?: unknown;
        json?: unknown;
        quiet?: unknown;
      };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';
      const quiet = globals.quiet === true || format === 'json';

      const { store } = await resolveStoreFromOptions(options);
      const { executePackBuild } = await import('../commands/packBuild.js');
      const res = await executePackBuild(name, { ...options, quiet }, store);
      if (format === 'json') {
        writeJsonSuccess(res);
      }
    });
}
