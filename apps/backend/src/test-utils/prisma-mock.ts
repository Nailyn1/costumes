export type ModelMock = Record<string, jest.Mock>;

export type PrismaMock = Record<string, ModelMock> & {
  $transaction: jest.Mock;
};

export interface PrismaMockKit {
  /** Мок PrismaService: вне транзакции. */
  prisma: PrismaMock;
  /** Мок клиента, который получает callback в `$transaction(async (tx) => ...)`. */
  tx: PrismaMock;
  /** Сбросить все моки и заново привязать `$transaction` → `tx`. Вызывать в `beforeEach`. */
  reset: () => void;
}

function createDelegates(): PrismaMock {
  const models = new Map<string, ModelMock>();

  // Делегаты моделей (`prisma.order`, `prisma.visit`...) и их методы (`findMany`...)
  // создаются лениво, поэтому не нужно заранее перечислять всю схему.
  const modelProxy = (): ModelMock => {
    const methods = new Map<string, jest.Mock>();
    return new Proxy(
      {},
      {
        get: (_target, method: string) => {
          if (!methods.has(method)) methods.set(method, jest.fn());
          return methods.get(method);
        },
        has: () => true,
        ownKeys: () => [...methods.keys()],
        getOwnPropertyDescriptor: (_target, method: string) =>
          methods.has(method)
            ? {
                enumerable: true,
                configurable: true,
                value: methods.get(method),
              }
            : undefined,
      },
    );
  };

  const transaction = jest.fn();

  return new Proxy({} as PrismaMock, {
    get: (_target, key: string) => {
      if (key === '$transaction') return transaction;
      if (!models.has(key)) models.set(key, modelProxy());
      return models.get(key);
    },
  });
}

/**
 * Общий мок Prisma для unit-тестов сервисов.
 *
 * ```ts
 * const { prisma, tx, reset } = createPrismaMock();
 * beforeEach(reset);
 * tx.visit.findFirst.mockResolvedValue(makeVisit());
 * ```
 */
export function createPrismaMock(): PrismaMockKit {
  const prisma = createDelegates();
  const tx = createDelegates();

  const bindTransaction = () => {
    prisma.$transaction.mockImplementation((fn: (client: unknown) => unknown) =>
      fn(tx),
    );
  };
  bindTransaction();

  return {
    prisma,
    tx,
    reset: () => {
      jest.resetAllMocks();
      bindTransaction();
    },
  };
}
