import {
  runSerializableTransaction,
  SERIALIZABLE_MAX_ATTEMPTS,
  SerializableTransactionRunner,
} from './serializable-transaction';

interface TestTransaction {
  attempt: number;
}

function makeSerializationConflict(): Error & { code: string } {
  return Object.assign(new Error('Serialization conflict'), { code: 'P2034' });
}

function makeRunner(
  attempt: { current: number },
  outcomes: unknown[],
): SerializableTransactionRunner<TestTransaction> {
  return jest.fn(async (callback, options) => {
    expect(options).toEqual({ isolationLevel: 'Serializable' });
    attempt.current += 1;
    const outcome = outcomes.shift();
    const result = await callback({ attempt: attempt.current });
    if (outcome instanceof Error) throw outcome;
    return result;
  });
}

describe('runSerializableTransaction', () => {
  it('retries the whole operation after a serialization conflict', async () => {
    const attempt = { current: 0 };
    const transaction = makeRunner(attempt, [
      makeSerializationConflict(),
      null,
    ]);
    const operation = jest.fn((tx: TestTransaction) =>
      Promise.resolve(tx.attempt),
    );

    await expect(
      runSerializableTransaction(transaction, operation),
    ).resolves.toBe(2);

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(operation.mock.calls.map(([tx]) => tx.attempt)).toEqual([1, 2]);
  });

  it('retries the PostgreSQL serialization error exposed by the Prisma adapter', async () => {
    const attempt = { current: 0 };
    const adapterConflict = Object.assign(
      new Error('TransactionWriteConflict'),
      {
        cause: {
          originalCode: '40001',
          kind: 'TransactionWriteConflict',
        },
      },
    );
    const transaction = makeRunner(attempt, [adapterConflict, null]);
    const operation = jest.fn((tx: TestTransaction) =>
      Promise.resolve(tx.attempt),
    );

    await expect(
      runSerializableTransaction(transaction, operation),
    ).resolves.toBe(2);

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries a PostgreSQL deadlock exposed by the Prisma adapter', async () => {
    const attempt = { current: 0 };
    const adapterDeadlock = Object.assign(new Error('TransactionDeadlock'), {
      cause: { originalCode: '40P01' },
    });
    const transaction = makeRunner(attempt, [adapterDeadlock, null]);
    const operation = jest.fn((tx: TestTransaction) =>
      Promise.resolve(tx.attempt),
    );

    await expect(
      runSerializableTransaction(transaction, operation),
    ).resolves.toBe(2);

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('stops after the bounded number of attempts', async () => {
    const attempt = { current: 0 };
    const conflicts = Array.from(
      { length: SERIALIZABLE_MAX_ATTEMPTS },
      makeSerializationConflict,
    );
    const transaction = makeRunner(attempt, conflicts);
    const operation = jest.fn(() => Promise.resolve('unused'));
    const exhaustedError = conflicts.at(-1);

    await expect(
      runSerializableTransaction(transaction, operation),
    ).rejects.toBe(exhaustedError);

    expect(transaction).toHaveBeenCalledTimes(SERIALIZABLE_MAX_ATTEMPTS);
    expect(operation).toHaveBeenCalledTimes(SERIALIZABLE_MAX_ATTEMPTS);
  });

  it('does not retry errors other than serialization conflicts', async () => {
    const attempt = { current: 0 };
    const error = new Error('Unexpected database error');
    const transaction = makeRunner(attempt, [error]);
    const operation = jest.fn(() => Promise.resolve('unused'));

    await expect(
      runSerializableTransaction(transaction, operation),
    ).rejects.toBe(error);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry unrecognized adapter errors', async () => {
    const attempt = { current: 0 };
    const error = Object.assign(new Error('UniqueConstraintViolation'), {
      cause: {
        originalCode: '23505',
        kind: 'UniqueConstraintViolation',
      },
    });
    const transaction = makeRunner(attempt, [error]);
    const operation = jest.fn(() => Promise.resolve('unused'));

    await expect(
      runSerializableTransaction(transaction, operation),
    ).rejects.toBe(error);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('returns the result from the successful full attempt', async () => {
    const attempt = { current: 0 };
    const transaction = makeRunner(attempt, [null, null]);
    const operation = jest.fn((tx: TestTransaction) =>
      Promise.resolve({ attempt: tx.attempt }),
    );

    await expect(
      runSerializableTransaction(transaction, operation),
    ).resolves.toEqual({ attempt: 1 });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
