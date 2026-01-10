import type { Command } from 'commander';
import { parseVarAssignments, resolveStoreFromOptions } from '../cliKit.js';
import { writeJsonSuccess } from '../output.js';
import { createCliServices } from '../services.js';

export function registerCoreCommands(program: Command): void {
  program
    .command('get <name>')
    .description('Render a prompt (alias for `prompt render`)')
    .option('--info', 'Output header + generated prompt text')
    .option('-u, --unfilled', 'Output prompt template text (placeholders not filled)')
    .option('-i, --interactive', 'Prompt for interactive variables (TTY only)')
    .option('--copy', 'Copy rendered output to clipboard')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .option(
      '--var <key=value|key@filepath>',
      'Variable override (repeatable)',
      (v: string, prev: string[]) => prev.concat(v),
      []
    )
    .addHelpText(
      'after',
      [
        '',
        'Variable overrides:',
        '  - Use `--var key=value` to override defaults stored in the prompt JSON file.',
        '  - Use `--var key@filepath` to load a value from a file (supports multiline).',
        '  - Example: `promptg get code-review --var language=TypeScript`',
        'Hints:',
        '  - Use `--quiet` to suppress non-essential status output (stderr).',
        'Interactive:',
        '  - Use `--interactive` to answer questions defined in the prompt JSON.',
        '  - Combine with `--copy` to copy the rendered output to the clipboard.',
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

      const vars = await parseVarAssignments(options.var);
      const resolved = await resolveStoreFromOptions(options);
      const store = resolved.store;
      const services = createCliServices();
      const { executeGet } = await import('../commands/get.js');
      await executeGet(
        services,
        name,
        { ...vars, ...options, format, quiet },
        store,
        resolved.mode === 'auto'
          ? {
              mode: 'auto',
              projectRoot: resolved.projectRoot,
              fallbackToGlobal: !!store?.rootDir,
              warnOnShadow: !!store?.rootDir,
            }
          : undefined
      );
    });

  program
    .command('import <source>')
    .description('Import a prompt or template from JSON (file path or URL)')
    .option('--file', 'Treat <source> as a local file path')
    .option('--url', 'Treat <source> as a URL (http/https)')
    .option('-f, --force', 'Overwrite if the prompt/template already exists')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  promptg import ./my-template.json',
        '  promptg import https://example.com/my-pack.json --url',
        '  promptg import ./prompt.json --store project',
        '  promptg import ./prompt.json --force',
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
      const { executeImport } = await import('../commands/import.js');
      const res = await executeImport(source, { ...options, quiet }, store);
      if (format === 'json') {
        writeJsonSuccess(res);
      }
    });

  program
    .command('status')
    .description('Show current context and store stats')
    .action(async (_options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as { format?: unknown; json?: unknown };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';
      const { executeStatus } = await import('../commands/status.js');
      await executeStatus({ format });
    });

  program
    .command('doctor')
    .description('Diagnose common environment and store issues')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Notes:',
        '  - This command is diagnostic and safe to run (best-effort checks).',
        '  - Use `--format json` (or `--json`) for machine-readable output.',
        '',
        'Examples:',
        '  promptg doctor',
        '  promptg doctor --store project',
        '  promptg doctor --format json',
        '',
      ].join('\n')
    )
    .action(async (options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as { format?: unknown; json?: unknown };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';
      const resolved = await resolveStoreFromOptions(options);
      const { executeDoctor } = await import('../commands/doctor.js');
      await executeDoctor({
        requestedMode: resolved.mode,
        selectedStore: resolved.store,
        format,
      });
    });

  program
    .command('version')
    .description('Print version')
    .action(async (_options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as { format?: unknown; json?: unknown };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';
      const { executeVersion } = await import('../commands/version.js');
      await executeVersion({ format });
    });

  program
    .command('init')
    .description('Initialize a project-local .promptg/ folder (prompts + templates + packs)')
    .action(async (_options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as {
        format?: unknown;
        json?: unknown;
        quiet?: unknown;
      };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';
      const quiet = globals.quiet === true || format === 'json';

      const { executeInit } = await import('../commands/init.js');
      const res = await executeInit(process.cwd(), { quiet });
      if (format === 'json') {
        writeJsonSuccess(res);
      }
    });

  program
    .command('validate')
    .description('Validate prompts, templates, and packs in the selected store')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Notes:',
        '  - Validates JSON shape and required fields for prompts/templates/packs.',
        '  - Exits non-zero if any issues are found (CI-friendly).',
        '  - Use `--format json` for machine-readable output.',
        '',
        'Examples:',
        '  promptg validate',
        '  promptg validate --store project',
        '  promptg validate --store global',
        '  promptg validate --format json',
        '',
      ].join('\n')
    )
    .action(async (options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as {
        format?: unknown;
        json?: unknown;
        quiet?: unknown;
      };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';
      const quiet = globals.quiet === true || format === 'json';

      const { store } = await resolveStoreFromOptions(options);
      const { executeValidate } = await import('../commands/validate.js');
      await executeValidate(store, { format, quiet });
    });

  // (UI removed)
}
