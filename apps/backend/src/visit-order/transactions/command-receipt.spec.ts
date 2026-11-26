import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils';
import {
  executeWithCommandReceipt,
  hashCommandRequest,
  type CommandReceiptIdentity,
} from './command-receipt';

interface CommandResult {
  visitId: number;
  status: string;
}

const commandIdentity: CommandReceiptIdentity = {
  commandId: 'command-1',
  actorUserId: 11,
  commandPath: '/visits/12/add-and-issue',
  requestHash: 'request-hash-1',
};

function makeReceipt(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ...commandIdentity,
    result: { visitId: 12, status: 'issued' },
    createdAt: new Date('2026-12-20T10:00:00Z'),
    ...overrides,
  };
}

function makeUniqueConflict(): Error & { code: string } {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
  });
}

describe('executeWithCommandReceipt', () => {
  const { prisma, tx, reset } = createPrismaMock();
  const database = prisma as never as PrismaService;
  const parseResult = (value: unknown) => value as CommandResult;

  beforeEach(reset);

  it('returns a stored result for the same actor, path, and request hash', async () => {
    const receipt = makeReceipt();
    prisma.commandReceipt.findUnique.mockResolvedValue(receipt);
    const operation = jest.fn(() =>
      Promise.resolve({ visitId: 99, status: 'issued' }),
    );

    await expect(
      executeWithCommandReceipt(
        database,
        commandIdentity,
        operation,
        parseResult,
      ),
    ).resolves.toEqual(receipt.result);

    expect(operation).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['actor', { actorUserId: 12 }],
    ['path', { commandPath: '/visits/other/add-and-issue' }],
    ['request hash', { requestHash: 'different-hash' }],
  ])(
    'rejects a reused command ID with a different %s',
    async (_field, override) => {
      prisma.commandReceipt.findUnique.mockResolvedValue(makeReceipt(override));

      await expect(
        executeWithCommandReceipt(
          database,
          commandIdentity,
          () => Promise.resolve({ visitId: 12, status: 'issued' }),
          parseResult,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    },
  );

  it('executes and stores the result in one serializable transaction', async () => {
    prisma.commandReceipt.findUnique.mockResolvedValue(null);
    tx.commandReceipt.findUnique.mockResolvedValue(null);
    const result = { visitId: 12, status: 'issued' };
    const operation = jest.fn(() => Promise.resolve(result));

    await expect(
      executeWithCommandReceipt(
        database,
        commandIdentity,
        operation,
        parseResult,
      ),
    ).resolves.toEqual(result);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(tx.commandReceipt.create).toHaveBeenCalledWith({
      data: { ...commandIdentity, result },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('returns the same schema-validated result on the first call and replay', async () => {
    const storedReceipt = makeReceipt();
    prisma.commandReceipt.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedReceipt);
    tx.commandReceipt.findUnique.mockResolvedValue(null);
    const operation = jest.fn(() =>
      Promise.resolve({ visitId: 12, status: ' ISSUED ' }),
    );
    const parseCanonicalResult = (value: unknown): CommandResult => {
      const candidate = value as CommandResult;
      return { ...candidate, status: candidate.status.trim().toLowerCase() };
    };

    const firstResult = await executeWithCommandReceipt(
      database,
      commandIdentity,
      operation,
      parseCanonicalResult,
    );
    const replayResult = await executeWithCommandReceipt(
      database,
      commandIdentity,
      operation,
      parseCanonicalResult,
    );

    expect(firstResult).toEqual(storedReceipt.result);
    expect(replayResult).toEqual(firstResult);
    expect(tx.commandReceipt.create).toHaveBeenCalledWith({
      data: { ...commandIdentity, result: storedReceipt.result },
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('validates the response before writing its receipt', async () => {
    prisma.commandReceipt.findUnique.mockResolvedValue(null);
    tx.commandReceipt.findUnique.mockResolvedValue(null);
    const invalidResult = { visitId: 12, status: 'invalid' };

    await expect(
      executeWithCommandReceipt(
        database,
        commandIdentity,
        () => Promise.resolve(invalidResult),
        () => {
          throw new Error('Invalid response');
        },
      ),
    ).rejects.toThrow('Invalid response');

    expect(tx.commandReceipt.create).not.toHaveBeenCalled();
  });

  it('returns a conflict after exhausting serializable retries', async () => {
    prisma.$transaction.mockRejectedValue(
      Object.assign(new Error('Serialization conflict'), { code: 'P2034' }),
    );

    await expect(
      executeWithCommandReceipt(
        database,
        commandIdentity,
        () => Promise.resolve({ visitId: 12, status: 'issued' }),
        parseResult,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('reads a competing receipt after a unique conflict aborts the transaction', async () => {
    const receipt = makeReceipt();
    prisma.commandReceipt.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(receipt);
    tx.commandReceipt.findUnique.mockResolvedValue(null);
    const uniqueConflict = makeUniqueConflict();
    prisma.$transaction.mockImplementation(
      async (callback: (client: unknown) => Promise<unknown>) => {
        await callback(tx);
        throw uniqueConflict;
      },
    );
    const operation = jest.fn(() =>
      Promise.resolve({ visitId: 12, status: 'issued' }),
    );

    await expect(
      executeWithCommandReceipt(
        database,
        commandIdentity,
        operation,
        parseResult,
      ),
    ).resolves.toEqual(receipt.result);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(prisma.commandReceipt.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('hashCommandRequest', () => {
  it('produces a stable hash independent of object key order', () => {
    expect(hashCommandRequest({ amount: 500, deposit: { type: 'cash' } })).toBe(
      hashCommandRequest({ deposit: { type: 'cash' }, amount: 500 }),
    );
  });

  it('changes when command data changes', () => {
    expect(hashCommandRequest({ amount: 500 })).not.toBe(
      hashCommandRequest({ amount: 501 }),
    );
  });

  it('rejects non-plain values instead of hashing them as empty objects', () => {
    expect(() => hashCommandRequest({ date: new Date('2026-12-20') })).toThrow(
      'plain JSON objects',
    );
  });
});
