export const SERIALIZABLE_MAX_ATTEMPTS = 3;

export interface SerializableTransactionOptions {
  isolationLevel: 'Serializable';
}

export type SerializableTransactionRunner<TTransaction> = <TResult>(
  callback: (transaction: TTransaction) => Promise<TResult>,
  options: SerializableTransactionOptions,
) => Promise<TResult>;

/**
 * Re-runs the complete interactive transaction after PostgreSQL reports a
 * serialization conflict. Callbacks must keep external side effects outside
 * the transaction because they may execute more than once.
 */
export async function runSerializableTransaction<TTransaction, TResult>(
  transaction: SerializableTransactionRunner<TTransaction>,
  operation: (tx: TTransaction) => Promise<TResult>,
): Promise<TResult> {
  for (let attempt = 1; attempt <= SERIALIZABLE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      if (
        !isSerializationConflict(error) ||
        attempt === SERIALIZABLE_MAX_ATTEMPTS
      ) {
        throw error;
      }
    }
  }

  throw new Error('Unreachable serializable transaction state');
}

export function isSerializationConflict(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.code === 'P2034') return true;

  const cause = error.cause;
  return (
    isRecord(cause) &&
    (cause.originalCode === '40001' || cause.originalCode === '40P01')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
