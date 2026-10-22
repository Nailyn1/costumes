import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../../prisma/generated/client';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  isSerializationConflict,
  runSerializableTransaction,
} from './serializable-transaction';

export interface CommandReceiptIdentity {
  commandId: string;
  actorUserId: number;
  commandPath: string;
  requestHash: string;
}

interface StoredReceipt {
  actorUserId: number;
  commandPath: string;
  requestHash: string;
  result: Prisma.JsonValue;
}

/**
 * Executes a future user command once and stores its response in the same
 * transaction. Keep commandId stable across retries and network resubmissions.
 */
export async function executeWithCommandReceipt<TResult>(
  prisma: PrismaService,
  identity: CommandReceiptIdentity,
  operation: (tx: Prisma.TransactionClient) => Promise<TResult>,
  parseResult: (value: Prisma.JsonValue) => TResult,
): Promise<TResult> {
  const savedReceipt = await prisma.commandReceipt.findUnique({
    where: { commandId: identity.commandId },
  });
  if (savedReceipt) return resolveReceipt(savedReceipt, identity, parseResult);

  try {
    return await runSerializableTransaction<Prisma.TransactionClient, TResult>(
      prisma.$transaction.bind(prisma),
      async (tx) => {
        const receipt = await tx.commandReceipt.findUnique({
          where: { commandId: identity.commandId },
        });
        if (receipt) return resolveReceipt(receipt, identity, parseResult);

        const result = await operation(tx);
        const normalizedResult = toPrismaJsonValue(result);
        if (normalizedResult === null) {
          throw new TypeError('Command result must be a non-null JSON value');
        }
        const validatedResult = parseResult(normalizedResult);
        const canonicalResult = toPrismaJsonValue(validatedResult);
        if (canonicalResult === null) {
          throw new TypeError('Command result must be a non-null JSON value');
        }
        await tx.commandReceipt.create({
          data: {
            ...identity,
            result: canonicalResult,
          },
        });
        return validatedResult;
      },
    );
  } catch (error: unknown) {
    if (isSerializationConflict(error)) {
      throw new ConflictException(
        'Данные команды изменились. Обновите данные и повторите попытку',
      );
    }
    if (!hasPrismaCode(error, 'P2002')) throw error;

    // A P2002 aborts its transaction. Read the competing receipt separately.
    const receipt = await prisma.commandReceipt.findUnique({
      where: { commandId: identity.commandId },
    });
    if (!receipt) throw error;
    return resolveReceipt(receipt, identity, parseResult);
  }
}

export function hashCommandRequest(request: unknown): string {
  return createHash('sha256').update(stableSerialize(request)).digest('hex');
}

function resolveReceipt<TResult>(
  receipt: StoredReceipt,
  identity: CommandReceiptIdentity,
  parseResult: (value: Prisma.JsonValue) => TResult,
): TResult {
  if (
    receipt.actorUserId !== identity.actorUserId ||
    receipt.commandPath !== identity.commandPath ||
    receipt.requestHash !== identity.requestHash
  ) {
    throw new ConflictException(
      'Команда с таким идентификатором уже выполнена с другими данными',
    );
  }
  return parseResult(receipt.result);
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(
        'Command request must contain only plain JSON objects',
      );
    }
    const entries = Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`)
      .join(',')}}`;
  }
  throw new TypeError('Command request must contain only JSON values');
}

function toPrismaJsonValue(value: unknown): Prisma.JsonValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError('Command result must contain only JSON values');
  }
  const parsed: unknown = JSON.parse(serialized);
  if (!isPrismaJsonValue(parsed)) {
    throw new TypeError('Command result must contain only JSON values');
  }
  return parsed;
}

function isPrismaJsonValue(value: unknown): value is Prisma.JsonValue {
  if (value === null) return true;
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item: unknown) => isPrismaJsonValue(item));
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null) &&
    Object.values(value).every((item: unknown) => isPrismaJsonValue(item))
  );
}
