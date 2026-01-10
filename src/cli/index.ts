import { Command, Help } from 'commander';
import { version } from './version.js';
import { helpWrap } from './cliKit.js';
import { exitProcess, handleError, writeJsonSuccess } from './output.js';
import { registerCoreCommands } from './register/core.js';
import { registerPackCommands } from './register/pack.js';
import { registerPromptCommands } from './register/prompt.js';
import { registerStoreCommands } from './register/store.js';
import { registerTemplateCommands } from './register/template.js';

type GlobalCliOptions = { format: 'text' | 'json'; quiet: boolean; debug: boolean };

function hasFlag(argv: string[], ...flags: string[]): boolean {
  return flags.some(f => argv.includes(f));
}

function resolveHelpTarget(program: Command, argv: string[]): Command {
  // Use Commander parsing to strip known global options so we can locate the intended subcommand.
  const { operands } = program.parseOptions(argv);
  let current: Command = program;

  for (let i = 2; i < operands.length; i += 1) {
    const token = operands[i] ?? '';
    if (!token || token.startsWith('-')) break;

    const next = current.commands.find(c => c.name() === token || c.aliases().includes(token));
    if (!next) break;
    current = next;
  }

  return current;
}

function readGlobals(program: Command): GlobalCliOptions {
  const raw = program.opts() as {
    format?: unknown;
    json?: unknown;
    quiet?: unknown;
    debug?: unknown;
  };
  const format = raw.json === true ? 'json' : raw.format === 'json' ? 'json' : 'text';
  return {
    format,
    quiet: raw.quiet === true,
    debug: raw.debug === true,
  };
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('promptg')
    .description('Prompts as code: versioned, shareable, standard.')
    .version(version);

  program
    .option('--format <format>', 'Output format: text|json', 'text')
    .option('--json', 'Output machine-readable JSON')
    .option('-q, --quiet', 'Suppress non-essential status output (stderr)')
    .option('--debug', 'Include diagnostic details in errors');

  // Parse global options first so we can enforce JSON purity for --help/--version and parse errors.
  program.parseOptions(argv);
  const globals = readGlobals(program);

  if (globals.format === 'json') {
    program.showHelpAfterError(false).showSuggestionAfterError(false);
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  } else {
    program.showHelpAfterError().showSuggestionAfterError();
  }

  program.exitOverride();

  // Root help is high-signal and grouped by domain.
  program.configureHelp({
    formatHelp: (cmd, helper) => {
      // Only override the root help. For subcommands, use Commander defaults.
      if (cmd.parent) {
        return Help.prototype.formatHelp.call(helper, cmd, helper);
      }

      const lines: string[] = [];
      const name = cmd.name();

      const visible = cmd.commands;
      const byName = new Map(visible.map(c => [c.name(), c] as const));

      const primary = ['get', 'init', 'prompt', 'template', 'pack', 'store', 'validate']
        .map(n => byName.get(n))
        .filter(Boolean);
      const other = visible.filter(c => !primary.includes(c));

      lines.push(cmd.description());
      lines.push('');

      lines.push('USAGE');
      lines.push(`  ${name} --help`);
      lines.push(`  ${name} <command> --help`);
      lines.push(`  ${name} <command> [options]`);
      lines.push('');

      lines.push('COMMANDS');
      for (const c of primary) {
        const term = helper.commandUsage(c!);
        const desc = c!.description();
        lines.push(`  ${term.padEnd(28)} ${desc}`);
      }
      lines.push('');

      if (other.length > 0) {
        lines.push('OTHER');
        for (const c of other) {
          const term = helper.commandUsage(c);
          const desc = c.description();
          lines.push(`  ${term.padEnd(28)} ${desc}`);
        }
        lines.push('');
      }

      lines.push('NOTES');
      lines.push(
        '  - Scope: use --store auto|project|global (auto detects project when .promptg/ exists)'
      );
      lines.push(
        '  - Variable overrides (get): pass `--var key=value` or `--var key@filepath` (repeatable)'
      );
      lines.push('    - `key@filepath` loads the value from a file (supports multiline)');
      lines.push('');

      return helpWrap(lines, helper);
    },
  });

  registerCoreCommands(program);
  registerPromptCommands(program);
  registerTemplateCommands(program);
  registerPackCommands(program);
  registerStoreCommands(program);

  const wantsHelp = hasFlag(argv, '--help', '-h');
  const wantsVersion = hasFlag(argv, '--version', '-V');

  if (globals.format === 'json' && (wantsHelp || argv.length <= 2)) {
    const target = resolveHelpTarget(program, argv);
    writeJsonSuccess({ help: target.helpInformation() });
    return;
  }

  try {
    if (globals.format === 'json' && wantsVersion) {
      writeJsonSuccess({ name: 'promptg', version });
      return;
    }

    if (argv.length <= 2 && globals.format !== 'json') {
      program.help({ error: false });
    }

    await program.parseAsync(argv);
  } catch (e) {
    // Commander uses exceptions for help/version due to exitOverride; treat as success in text mode.
    if (
      e &&
      typeof e === 'object' &&
      typeof (e as { code?: unknown }).code === 'string' &&
      (String((e as { code?: unknown }).code) === 'commander.helpDisplayed' ||
        String((e as { code?: unknown }).code) === 'commander.outputHelp' ||
        String((e as { code?: unknown }).code) === 'commander.version')
    ) {
      return;
    }

    if (
      globals.format !== 'json' &&
      e &&
      typeof e === 'object' &&
      typeof (e as { code?: unknown }).code === 'string' &&
      String((e as { code?: unknown }).code).startsWith('commander.')
    ) {
      // In text mode Commander already printed the error/help; just honor our stable exit code.
      exitProcess(2);
    }

    handleError(e, { format: globals.format, quiet: globals.quiet, debug: globals.debug });
  }
}
