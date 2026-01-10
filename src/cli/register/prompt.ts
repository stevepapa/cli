import type { Command } from 'commander';
import { parseVarAssignments, resolveStoreFromOptions } from '../cliKit.js';
import { UsageError } from '../errors.js';
import { writeJsonSuccess } from '../output.js';
import { createCliServices } from '../services.js';

export function registerPromptCommands(program: Command): void {
  const prompt = program.command('prompt').alias('p').description('Prompt management commands');

  prompt
    .command('render <name>')
    .description('Render a prompt (prints prompt text by default)')
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
        'Examples:',
        '  promptg prompt render code-review',
        '  promptg prompt render code-review --interactive',
        '  promptg prompt render code-review --var diff@./pr-diff.txt',
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

  prompt
    .command('show <name>')
    .description('Show a prompt as JSON')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  promptg prompt show code-review',
        '  promptg prompt show code-review --format json',
        '',
      ].join('\n')
    )
    .action(async (name: string, options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as { format?: unknown; json?: unknown };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';
      const resolved = await resolveStoreFromOptions(options);
      const { executePromptShow } = await import('../commands/promptShow.js');
      await executePromptShow({
        name,
        store: resolved.store,
        mode: resolved.mode,
        format,
      });
    });

  prompt
    .command('list')
    .alias('ls')
    .description('List prompts in a store')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .option('--filter <substring>', 'Filter prompts by name/description/tags')
    .option('-l, --long', 'Show detailed output (text mode only)')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  promptg prompt list',
        '  promptg prompt list --store global',
        '  promptg prompt list --format json',
        '  promptg prompt list --filter security',
        '  promptg prompt list --long',
        '',
      ].join('\n')
    )
    .action(async (options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as { format?: unknown; json?: unknown };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';

      const { store, mode } = await resolveStoreFromOptions(options);
      const { executeList } = await import('../commands/list.js');
      await executeList(store, mode, format, {
        filter: typeof options.filter === 'string' ? options.filter : undefined,
        long: options.long === true,
      });
    });

  prompt
    .command('new <name>')
    .description('Create a new prompt (from scratch or from a template)')
    .option('--from-template <template>', 'Create by instantiating a template')
    .option('-f, --force', 'Overwrite if the prompt already exists')
    .option(
      '--var <key=value|key@filepath>',
      'Default value to store on the created prompt (repeatable; requires --from-template)',
      (v: string, prev: string[]) => prev.concat(v),
      []
    )
    .option('-i, --interactive', 'Prompt for missing defaults (TTY only; requires --from-template)')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Notes:',
        '  - Without --from-template, opens your editor to create prompt content (multiline supported).',
        '  - With --from-template, deep copies the embedded prompt in the template (wrapper metadata is ignored).',
        '  - Use --force to overwrite an existing prompt.',
        '',
        'Examples:',
        '  promptg prompt new code-review',
        '  promptg prompt new my-pr-review --from-template pr-review',
        '  promptg prompt new my-pr-review --from-template pr-review --interactive',
        '  promptg prompt new my-pr-review --from-template pr-review --var diff@./diff.txt',
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

      const fromTemplate =
        typeof options.fromTemplate === 'string' ? options.fromTemplate : undefined;

      if (fromTemplate) {
        const vars = await parseVarAssignments(options.var);
        const resolved = await resolveStoreFromOptions(options);
        const { executeCreatePromptFromTemplate } =
          await import('../commands/createPromptFromTemplate.js');
        await executeCreatePromptFromTemplate(fromTemplate, name, resolved.store, resolved.mode, {
          ...vars,
          ...options,
          quiet,
        });
        if (format === 'json') writeJsonSuccess({ action: 'prompt.new', name, fromTemplate });
        return;
      }

      if (options.interactive === true || (Array.isArray(options.var) && options.var.length > 0)) {
        throw new UsageError('`--interactive` and `--var` require `--from-template <template>`');
      }

      const { store } = await resolveStoreFromOptions(options);
      const { executePromptNew } = await import('../commands/promptNew.js');
      await executePromptNew(name, store, { force: options.force === true, quiet });
      if (format === 'json') writeJsonSuccess({ action: 'prompt.new', name });
    });

  prompt
    .command('edit <name>')
    .description('Edit an existing prompt in your editor')
    .option('--raw', 'Edit the full prompt JSON document (advanced)')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Notes:',
        '  - Default mode edits prompt content only (multiline supported).',
        '  - Use --raw to edit the full prompt JSON document (metadata, defaults, interactive).',
        '  - Use `prompt rename` to change the prompt name.',
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
      const { executePromptEdit } = await import('../commands/promptEdit.js');
      await executePromptEdit(name, store, { quiet, raw: options.raw === true });
      if (format === 'json') writeJsonSuccess({ action: 'prompt.edit', name });
    });

  prompt
    .command('rename <oldName> <newName>')
    .description('Rename a prompt (atomic)')
    .option('-f, --force', 'Overwrite if the target name already exists')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .action(
      async (
        oldName: string,
        newName: string,
        options: Record<string, unknown>,
        command: Command
      ) => {
        const globals = command.optsWithGlobals() as {
          format?: unknown;
          json?: unknown;
          quiet?: unknown;
        };
        const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';
        const quiet = globals.quiet === true || format === 'json';

        const resolved = await resolveStoreFromOptions(options);
        const { executePromptRename } = await import('../commands/promptRename.js');
        await executePromptRename(oldName, newName, resolved.store, {
          force: options.force === true,
          quiet,
        });
        if (format === 'json') writeJsonSuccess({ action: 'prompt.rename', oldName, newName });
      }
    );

  prompt
    .command('meta <name>')
    .description('Edit prompt metadata (display name, description, tags)')
    .option('--display-name <value>', 'Set display name')
    .option('--description <value>', 'Set description')
    .option(
      '--tag <tag>',
      'Add tag (repeatable)',
      (v: string, prev: string[]) => prev.concat(v),
      []
    )
    .option(
      '--remove-tag <tag>',
      'Remove tag (repeatable)',
      (v: string, prev: string[]) => prev.concat(v),
      []
    )
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .action(async (name: string, options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as {
        format?: unknown;
        json?: unknown;
        quiet?: unknown;
      };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';
      const quiet = globals.quiet === true || format === 'json';

      const resolved = await resolveStoreFromOptions(options);
      const { executePromptMeta } = await import('../commands/promptMeta.js');
      await executePromptMeta(name, resolved.store, {
        displayName: options.displayName,
        description: options.description,
        tag: options.tag,
        removeTag: options.removeTag,
        quiet,
      });
      if (format === 'json') writeJsonSuccess({ action: 'prompt.meta', name });
    });

  prompt
    .command('save <name>')
    .description('Save a prompt from stdin')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  echo "Review this code for bugs" | promptg prompt save code-review',
        '  cat prompt.txt | promptg prompt save my-prompt --store project',
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
      const { executeSave } = await import('../commands/save.js');
      await executeSave(name, store, { quiet });
      if (format === 'json') writeJsonSuccess({ action: 'prompt.save', name });
    });

  prompt
    .command('delete <name>')
    .alias('rm')
    .description('Delete a prompt')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  promptg prompt delete code-review',
        '  promptg prompt rm code-review',
        '  promptg prompt delete code-review --store global',
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

      const resolved = await resolveStoreFromOptions(options);
      const { executeRm } = await import('../commands/rm.js');
      await executeRm(name, resolved.store, resolved.mode, { quiet });
      if (format === 'json') writeJsonSuccess({ action: 'prompt.delete', name });
    });
}
