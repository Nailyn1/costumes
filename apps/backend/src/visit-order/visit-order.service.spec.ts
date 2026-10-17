import { BadRequestException, NotFoundException } from '@nestjs/common';
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
  visit: { findFirst: jest.fn() },
};
const txMock = {
  client: { findFirst: jest.fn() },
  child: { findMany: jest.fn() },
  costume: { findMany: jest.fn() },
  visit: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  order: { findMany: jest.fn(), update: jest.fn() },
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
      txMock.visit.findFirst.mockResolvedValue({ id: 1, status, orders: [] });

      const promise = service.visitIssue(issueData, 1);

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(fragment);
      expect(txMock.order.update).not.toHaveBeenCalled();
      expect(txMock.visit.update).not.toHaveBeenCalled();
    });

    it('issues a reserved visit', async () => {
      txMock.visit.findFirst.mockResolvedValue({
        id: 1,
        status: 'reserved',
        orders: [],
      });

      await service.visitIssue(issueData, 1);

      expect(txMock.visit.update).toHaveBeenCalled();
    });

    it('rejects a deleted visit as not found', async () => {
      txMock.visit.findFirst.mockResolvedValue(null);

      await expect(service.visitIssue(issueData, 1)).rejects.toThrow(
        new NotFoundException('Визит с ID 1 не найден'),
      );
      expect(txMock.visit.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: { orders: true },
      });
      expect(txMock.visit.update).not.toHaveBeenCalled();
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
      txMock.child.findMany.mockResolvedValue([{ id: 1, clientId: 7 }]);
      txMock.costume.findMany.mockResolvedValue([{ id: 1 }]);
      txMock.order.findMany.mockResolvedValue([]);
    });

    it('rejects a blacklisted client and mentions the reason', async () => {
      txMock.client.findFirst.mockResolvedValue({
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
      txMock.client.findFirst.mockResolvedValue({
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

    it('rejects a deleted client as not found', async () => {
      txMock.client.findFirst.mockResolvedValue(null);

      await expect(service.createVisit(createData, false)).rejects.toThrow(
        new NotFoundException('Клиент с ID 7 не найден'),
      );
      expect(txMock.client.findFirst).toHaveBeenCalledWith({
        where: { id: 7, deletedAt: null },
      });
      expect(txMock.visit.create).not.toHaveBeenCalled();
    });

    it('rejects a missing or deleted child with its order position', async () => {
      txMock.client.findFirst.mockResolvedValue({
        id: 7,
        isBlacklisted: false,
      });
      txMock.child.findMany.mockResolvedValue([]);

      await expect(service.createVisit(createData, false)).rejects.toThrow(
        /заказ 1: ребёнок ID 1 не найден или удалён/,
      );
      expect(txMock.child.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1] }, deletedAt: null },
        select: { id: true, clientId: true },
      });
      expect(txMock.visit.create).not.toHaveBeenCalled();
    });

    it('rejects a child belonging to another client', async () => {
      txMock.client.findFirst.mockResolvedValue({
        id: 7,
        isBlacklisted: false,
      });
      txMock.child.findMany.mockResolvedValue([{ id: 1, clientId: 8 }]);

      await expect(service.createVisit(createData, false)).rejects.toThrow(
        /заказ 1: ребёнок ID 1 не принадлежит клиенту/,
      );
      expect(txMock.visit.create).not.toHaveBeenCalled();
    });

    it('rejects a missing or deleted costume with its order position', async () => {
      txMock.client.findFirst.mockResolvedValue({
        id: 7,
        isBlacklisted: false,
      });
      txMock.costume.findMany.mockResolvedValue([]);

      await expect(service.createVisit(createData, false)).rejects.toThrow(
        /заказ 1: костюм ID 1 не найден или удалён/,
      );
      expect(txMock.costume.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1] }, deletedAt: null },
        select: { id: true },
      });
      expect(txMock.visit.create).not.toHaveBeenCalled();
    });

    it('lists every invalid position in one error', async () => {
      txMock.client.findFirst.mockResolvedValue({
        id: 7,
        isBlacklisted: false,
      });
      txMock.child.findMany.mockResolvedValue([{ id: 1, clientId: 7 }]);
      txMock.costume.findMany.mockResolvedValue([{ id: 1 }]);
      const data = {
        clientId: 7,
        visitCode: '1234',
        startDateTime: '2026-12-20',
        endDateTime: '2026-12-21',
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
        orders: [
          { childId: 2, costumeId: 1, rentPrice: 5000, prepaymentAmount: 0 },
          { childId: 1, costumeId: 3, rentPrice: 5000, prepaymentAmount: 0 },
        ],
      } as never;

      await expect(service.createVisit(data, false)).rejects.toThrow(
        /заказ 1: ребёнок ID 2 не найден или удалён; заказ 2: костюм ID 3 не найден или удалён/,
      );
      expect(txMock.visit.create).not.toHaveBeenCalled();
    });
  });

  it('ignores deleted orders when checking costume availability', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);

    await service.isSuitAvailability(
      [1],
      new Date('2026-12-20'),
      new Date('2026-12-21'),
    );

    expect(prismaMock.order.findMany).toHaveBeenCalledWith({
      where: {
        costumeId: { in: [1] },
        deletedAt: null,
        status: { not: 'cancelled' },
        AND: [
          { startDateTime: { lt: new Date('2026-12-21') } },
          { endDateTime: { gt: new Date('2026-12-20') } },
        ],
      },
      select: { costume: { select: { id: true, name: true } } },
    });
  });

  describe('deleted visits', () => {
    it('rejects unissue', async () => {
      txMock.visit.findFirst.mockResolvedValue(null);

      await expect(service.visitUnissue(1)).rejects.toThrow(
        new NotFoundException('Визит с ID 1 не найден'),
      );
      expect(txMock.visit.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
      });
    });

    it('rejects cancel', async () => {
      prismaMock.visit.findFirst.mockResolvedValue(null);

      await expect(service.visitCancel(1, {} as never)).rejects.toThrow(
        new NotFoundException('Визит с ID 1 не найден'),
      );
      expect(prismaMock.visit.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
      });
    });

    it('rejects complete return', async () => {
      prismaMock.visit.findFirst.mockResolvedValue(null);

      await expect(service.visitCompleteReturn(1, {} as never)).rejects.toThrow(
        new NotFoundException('Визит №1 не найден'),
      );
      expect(prismaMock.visit.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: { orders: true, deposit: true },
      });
    });

    it('rejects deposit return', async () => {
      prismaMock.visit.findFirst.mockResolvedValue(null);

      await expect(service.MarkDepositReturned(1)).rejects.toThrow(
        new NotFoundException('Визит с ID 1 не найден'),
      );
      expect(prismaMock.visit.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: { deposit: true },
      });
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
