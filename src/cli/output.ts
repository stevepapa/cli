import { CliError, RuntimeError, UsageError, ValidationError } from './errors.js';
import { isInfraError } from '../core/infra/errors.js';

export type JsonWarning = { code: string; message: string };
export type JsonEnvelope =
  | { ok: true; data: unknown; warnings: JsonWarning[] }
  | {
      ok: false;
      error: { code: string; message: string; details?: Record<string, unknown> };
      warnings: JsonWarning[];
    };

export function writeJsonEnvelope(envelope: JsonEnvelope): void {
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
}

export function writeJsonSuccess(data: unknown, warnings: JsonWarning[] = []): void {
  writeJsonEnvelope({ ok: true, data, warnings });
}

export function exitProcess(exitCode: number): never {
  process.exit(exitCode);
}

function coerceError(err: unknown): CliError {
  if (err instanceof CliError) return err;
  if (isInfraError(err)) {
    const details = {
      ...(err.details ?? {}),
      infraCode: err.infraCode,
    } as Record<string, unknown>;

    if (
      err.infraCode === 'NOT_FOUND' ||
      err.infraCode === 'CONFLICT' ||
      err.infraCode === 'INVALID_DATA'
    ) {
      return new ValidationError(err.message, details);
    }

    return new RuntimeError(err.message, details);
  }
  if (err && typeof err === 'object') {
    const code = (err as { code?: unknown }).code;
    const message = (err as { message?: unknown }).message;
    if (typeof code === 'string' && code.startsWith('commander.')) {
      return new UsageError(
        typeof message === 'string' && message.trim().length > 0
          ? message
          : 'Invalid command usage.'
      );
    }
  }
  if (err instanceof Error) return new RuntimeError(err.message);
  return new RuntimeError(typeof err === 'string' ? err : 'Unknown error');
}

function printHints(details: unknown): void {
  if (!details || typeof details !== 'object') return;
  const hints = (details as { hints?: unknown }).hints;
  if (!Array.isArray(hints)) return;
  for (const hint of hints) {
    if (typeof hint === 'string' && hint.trim().length > 0) {
      process.stderr.write(`hint: ${hint}\n`);
    }
  }
}

function printValidationIssues(details: unknown): void {
  if (!details || typeof details !== 'object') return;
  const issues = (details as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return;
  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') continue;
    const kind =
      typeof (issue as { kind?: unknown }).kind === 'string'
        ? String((issue as { kind?: unknown }).kind)
        : 'issue';
    const filePath =
      typeof (issue as { filePath?: unknown }).filePath === 'string'
        ? String((issue as { filePath?: unknown }).filePath)
        : '';
    const message =
      typeof (issue as { message?: unknown }).message === 'string'
        ? String((issue as { message?: unknown }).message)
        : '';
    process.stderr.write(`error: [${kind}] ${filePath}: ${message}\n`);
  }
}

export function handleError(
  error: unknown,
  options?: { format?: unknown; quiet?: boolean; debug?: boolean }
): never {
  const format = options?.format === 'json' ? 'json' : 'text';
  const debug = options?.debug === true;
  const err = coerceError(error);

  if (format === 'json') {
    let details: Record<string, unknown> | undefined = err.details ? { ...err.details } : undefined;

    if (debug && error instanceof Error) {
      const existing = (details ?? {}) as Record<string, unknown>;
      if (!details) details = existing;
      details.debug = {
        stack: typeof error.stack === 'string' ? error.stack : undefined,
        cause:
          error.cause instanceof Error
            ? error.cause.message
            : typeof error.cause === 'string'
              ? error.cause
              : undefined,
      };
    }

    writeJsonEnvelope({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        details,
      },
      warnings: [],
    });
    process.exit(err.exitCode);
  }

  if (err.code === 'VALIDATION') {
    printValidationIssues(err.details);
  }

  process.stderr.write(`error: ${err.message}\n`);
  printHints(err.details);
  if (debug && error instanceof Error && typeof error.stack === 'string') {
    process.stderr.write(`${error.stack}\n`);
  }
  process.exit(err.exitCode);
}
