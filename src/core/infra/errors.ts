export type InfraErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'INVALID_DATA' | 'IO' | 'NETWORK';

export class InfraError extends Error {
  public readonly infraCode: InfraErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(params: {
    infraCode: InfraErrorCode;
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'InfraError';
    this.infraCode = params.infraCode;
    this.details = params.details;
  }
}

export function isInfraError(error: unknown): error is InfraError {
  return error instanceof InfraError;
}
