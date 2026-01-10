import { InfraError } from '../../core/infra/errors.js';

export type StorageEntityKind = 'prompt' | 'template';

export class StorageNotFoundError extends InfraError {
  public readonly kind: StorageEntityKind;
  public readonly entityName: string;

  constructor(kind: StorageEntityKind, entityName: string) {
    super({
      infraCode: 'NOT_FOUND',
      message: `${kind === 'prompt' ? 'Prompt' : 'Template'} "${entityName}" not found`,
      details: { kind, name: entityName },
    });
    this.name = 'StorageNotFoundError';
    this.kind = kind;
    this.entityName = entityName;
  }
}

export function isStorageNotFoundError(
  error: unknown,
  kind?: StorageEntityKind
): error is StorageNotFoundError {
  if (!(error instanceof StorageNotFoundError)) return false;
  if (kind) return error.kind === kind;
  return true;
}
