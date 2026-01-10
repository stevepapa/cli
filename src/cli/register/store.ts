import type { Command } from 'commander';
import { resolveStoreFromOptions } from '../cliKit.js';
import { writeJsonSuccess } from '../output.js';

export function registerStoreCommands(program: Command): void {
  const storeCmd = program.command('store').description('Store utilities');

  storeCmd.addHelpText(
    'after',
    [
      '',
      'Examples:',
      '  promptg store path',
      '  promptg store path --store project',
      '  promptg status',
      '  promptg status --format json',
      '',
    ].join('\n')
  );

  storeCmd
    .command('path')
    .description('Print the resolved store root directory')
    .option('--store <store>', 'Store scope: auto|project|global', 'auto')
    .action(async (options: Record<string, unknown>, command: Command) => {
      const globals = command.optsWithGlobals() as { format?: unknown; json?: unknown };
      const format = globals.json === true || globals.format === 'json' ? 'json' : 'text';

      const resolved = await resolveStoreFromOptions(options);
      const root =
        resolved.store?.rootDir ?? (await import('../../node/storage/storage.js')).getStorageDir();

      if (format === 'json') {
        writeJsonSuccess({ rootDir: root });
        return;
      }

      process.stdout.write(`${root}\n`);
    });
}
