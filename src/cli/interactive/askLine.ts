import * as fs from 'node:fs';
import * as readline from 'node:readline';
import * as tty from 'node:tty';
import { CanceledError, RuntimeError, UsageError } from '../errors.js';

export type AskLine = (params: {
  sessionHeader?: { promptName: string; totalQuestions: number };
  question: string;
  help?: string;
  defaultValue?: string;
  required?: boolean;
}) => Promise<string>;

function openControllingTtyStdin(): { stdin: tty.ReadStream; close: () => void } {
  const candidates = process.platform === 'win32' ? ['CONIN$', '\\\\.\\CON'] : ['/dev/tty'];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const fd = fs.openSync(candidate, 'r');
      const stdin = new tty.ReadStream(fd);
      return {
        stdin,
        close: () => {
          try {
            stdin.destroy();
          } finally {
            try {
              fs.closeSync(fd);
            } catch {
              // ignore
            }
          }
        },
      };
    } catch (e) {
      lastError = e;
    }
  }

  void lastError;
  throw new RuntimeError('Unable to open controlling TTY for interactive input.');
}

export const askLine: AskLine = async params => {
  if (!process.stderr.isTTY) {
    throw new UsageError('--interactive requires a TTY');
  }

  const ttyInput = process.stdin.isTTY
    ? ({ stdin: process.stdin, close: () => {} } as const)
    : openControllingTtyStdin();

  const defaultValue = params.defaultValue ?? '';
  const required = params.required === true;

  try {
    if (params.sessionHeader) {
      process.stderr.write(
        `Interactive prompts: ${params.sessionHeader.promptName} (${
          params.sessionHeader.totalQuestions
        } question${params.sessionHeader.totalQuestions === 1 ? '' : 's'})\n\n`
      );
    }

    if (params.help && params.help.trim().length > 0) {
      process.stderr.write(`${params.help.trim()}\n`);
    }

    while (true) {
      const suffix = defaultValue.length > 0 ? ` (${defaultValue})` : '';

      const rl = readline.createInterface({
        input: ttyInput.stdin,
        output: process.stderr,
        terminal: true,
      });

      const answer = await new Promise<string>((resolve, reject) => {
        let settled = false;
        const settleResolve = (value: string) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const settleReject = (err: unknown) => {
          if (settled) return;
          settled = true;
          reject(err);
        };

        rl.on('SIGINT', () => {
          try {
            rl.close();
          } finally {
            settleReject(new CanceledError());
          }
        });

        rl.question(`${params.question}${suffix}: `, value => {
          rl.close();
          settleResolve(value);
        });
      });

      const normalized = answer.trim();
      const resolved =
        normalized.length === 0 && defaultValue.length > 0 ? defaultValue : normalized;
      if (required && resolved.trim().length === 0) {
        process.stderr.write('Value is required.\n');
        continue;
      }

      return resolved;
    }
  } finally {
    ttyInput.close();
  }
};
