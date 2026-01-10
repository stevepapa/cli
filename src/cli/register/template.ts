import type { Command } from 'commander';
import { resolveStoreFromOptions } from '../cliKit.js';
import { writeJsonSuccess } from '../output.js';

export function registerTemplateCommands(program: Command): void {
  const template = program
    .command('template')
    .alias('t')
    .description('Template management commands');

  template
    .command('list')
    .alias('ls')
    .description('List templates in a store')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .option('--filter <substring>', 'Filter templates by name/description/tags')
    .option('-l, --long', 'Show detailed output (text mode only)')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  promptg template list',
        '  promptg template list --format json',
        '  promptg template list --filter review',
        '  promptg template list --long',
        '',
      ].join('\n')
    )
    .action(async (options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as { format?: unknown; json?: unknown };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';

      const { store } = await resolveStoreFromOptions(options);
      const { executeTemplateList } = await import('../commands/templateList.js');
      await executeTemplateList(store, format, {
        filter: typeof options.filter === 'string' ? options.filter : undefined,
        long: options.long === true,
      });
    });

  template
    .command('new <name>')
    .description('Create a new template by editing JSON in your editor')
    .option('-f, --force', 'Overwrite if the template already exists')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Notes:',
        '  - Opens your editor with a template JSON skeleton.',
        '  - Templates require displayName, description, and an embedded prompt.',
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
      const { executeTemplateNew } = await import('../commands/templateNew.js');
      await executeTemplateNew(name, store, { force: options.force === true, quiet });
      if (format === 'json') writeJsonSuccess({ action: 'template.new', name });
    });

  template
    .command('edit <name>')
    .description('Edit an existing template JSON in your editor')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .action(async (name: string, options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as {
        format?: unknown;
        json?: unknown;
        quiet?: unknown;
      };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';
      const quiet = globals.quiet === true || format === 'json';

      const { store } = await resolveStoreFromOptions(options);
      const { executeTemplateEdit } = await import('../commands/templateEdit.js');
      await executeTemplateEdit(name, store, { quiet });
      if (format === 'json') writeJsonSuccess({ action: 'template.edit', name });
    });

  template
    .command('delete <name>')
    .alias('rm')
    .description('Delete a template')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  promptg template delete pr-review',
        '  promptg template rm pr-review',
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
      const { executeTemplateRm } = await import('../commands/templateRm.js');
      await executeTemplateRm(name, store, { quiet });
      if (format === 'json') writeJsonSuccess({ action: 'template.delete', name });
    });

  template
    .command('show <name>')
    .description('Show a template as JSON (templates are not rendered)')
    .option('--embedded', 'Show the embedded prompt JSON only')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  promptg template show pr-review',
        '  promptg template show pr-review --embedded',
        '  promptg template show pr-review --format json',
        '',
      ].join('\n')
    )
    .action(async (name: string, options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as { format?: unknown; json?: unknown };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';

      const resolved = await resolveStoreFromOptions(options);
      const { executeTemplateShow } = await import('../commands/templateShow.js');
      await executeTemplateShow({
        name,
        embedded: options.embedded === true,
        store: resolved.store,
        mode: resolved.mode,
        format,
      });
    });
}
