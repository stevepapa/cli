export type CliErrorCode = 'USAGE' | 'VALIDATION' | 'RUNTIME';

export class CliError extends Error {
  public readonly code: CliErrorCode;
  public readonly exitCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(params: {
    code: CliErrorCode;
    message: string;
    exitCode: number;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'CliError';
    this.code = params.code;
    this.exitCode = params.exitCode;
    this.details = params.details;
  }
}

export class UsageError extends CliError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ code: 'USAGE', message, exitCode: 2, details });
    this.name = 'UsageError';
  }
}

export class ValidationError extends CliError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ code: 'VALIDATION', message, exitCode: 1, details });
    this.name = 'ValidationError';
  }
}

export class RuntimeError extends CliError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ code: 'RUNTIME', message, exitCode: 1, details });
    this.name = 'RuntimeError';
  }
}

export class CanceledError extends CliError {
  constructor(message = 'Canceled.') {
    super({ code: 'RUNTIME', message, exitCode: 130 });
    this.name = 'CanceledError';
  }
}
