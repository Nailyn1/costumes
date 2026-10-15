import { BadRequestException } from '@nestjs/common';
import { VisitOrderService } from './visit-order.sevice';

// Сгенерированный Prisma-клиент импортирует `./x.js`, что jest без
// moduleNameMapper не резолвит, поэтому заменяем его и PrismaService заглушками.
jest.mock('../prisma/generated/client', () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const prismaMock = {
  $transaction: jest.fn(),
  order: { findMany: jest.fn() },
};
const txMock = {
  visit: { findUnique: jest.fn(), update: jest.fn() },
  order: { update: jest.fn() },
  deposit: { create: jest.fn() },
};

const createService = () =>
  new VisitOrderService(
    {} as never,
    {} as never,
    prismaMock as never,
    {} as never,
  );

describe('VisitOrderService', () => {
  let service: VisitOrderService;

  beforeEach(() => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(txMock),
    );
    service = createService();
  });

  describe('visitIssue', () => {
    const issueData = {
      deposit: { type: 'none' },
      additionalPayment: 0,
    } as never;

    it.each([
      ['issued', 'уже выдан'],
      ['completed', 'уже завершён'],
      ['cancelled', 'отменена'],
    ])('rejects a %s visit', async (status, fragment) => {
      txMock.visit.findUnique.mockResolvedValue({ id: 1, status, orders: [] });

      const promise = service.visitIssue(issueData, 1);

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(fragment);
      expect(txMock.order.update).not.toHaveBeenCalled();
      expect(txMock.visit.update).not.toHaveBeenCalled();
    });

    it('issues a reserved visit', async () => {
      txMock.visit.findUnique.mockResolvedValue({
        id: 1,
        status: 'reserved',
        orders: [],
      });

      await service.visitIssue(issueData, 1);

      expect(txMock.visit.update).toHaveBeenCalled();
    });
  });
});
