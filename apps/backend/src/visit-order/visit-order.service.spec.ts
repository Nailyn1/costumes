import { BadRequestException } from '@nestjs/common';
import { VisitOrderService } from './visit-order.sevice';

// Сгенерированный Prisma-клиент импортирует `./x.js`, что jest без
// moduleNameMapper не резолвит, поэтому заменяем его и PrismaService заглушками.
jest.mock('../prisma/generated/client', () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const redisMock = { get: jest.fn() };
const prismaMock = {
  $transaction: jest.fn(),
  order: { findMany: jest.fn() },
};
const txMock = {
  client: { findUnique: jest.fn() },
  visit: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  order: { update: jest.fn() },
  deposit: { create: jest.fn() },
};

const createService = () =>
  new VisitOrderService(
    redisMock as never,
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

  describe('createVisit', () => {
    const createData = {
      clientId: 7,
      visitCode: '1234',
      startDateTime: '2026-12-20',
      endDateTime: '2026-12-21',
      issueTimeFrom: '10:00',
      issueTimeTo: '19:00',
      returnTimeUntil: '19:00',
      orders: [
        { childId: 1, costumeId: 1, rentPrice: 5000, prepaymentAmount: 1000 },
      ],
    } as never;

    beforeEach(() => {
      redisMock.get.mockResolvedValue('1');
      prismaMock.order.findMany.mockResolvedValue([]);
    });

    it('rejects a blacklisted client and mentions the reason', async () => {
      txMock.client.findUnique.mockResolvedValue({
        id: 7,
        name: 'Алия',
        isBlacklisted: true,
        blacklistReason: 'не вернула костюм',
      });

      const promise = service.createVisit(createData, false);

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(/не вернула костюм/);
      await expect(promise).rejects.toThrow(/«Клиенты»/);
      expect(txMock.visit.create).not.toHaveBeenCalled();
    });

    it('rejects a blacklisted client without a reason', async () => {
      txMock.client.findUnique.mockResolvedValue({
        id: 7,
        name: 'Алия',
        isBlacklisted: true,
        blacklistReason: null,
      });

      const promise = service.createVisit(createData, false);

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.not.toThrow(/Причина/);
      expect(txMock.visit.create).not.toHaveBeenCalled();
    });
  });

  describe('findOrdersNotWritten', () => {
    it('selects only active orders of open visits with unwritten tags', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);

      const result = await service.findOrdersNotWritten();

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tagStatus: 'not_written',
            deletedAt: null,
            status: { notIn: ['cancelled', 'returned'] },
            visit: {
              deletedAt: null,
              status: { notIn: ['completed', 'cancelled'] },
            },
          },
        }),
      );
      expect(result.items).toEqual([]);
    });
  });
});
