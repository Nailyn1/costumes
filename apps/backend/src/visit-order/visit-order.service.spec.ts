import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VisitOrderService } from './visit-order.sevice';

import { createPrismaMock, makeCreateVisitRequest } from '../test-utils';

jest.mock('../prisma/generated/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code = '';
    },
  },
  OrderStatus: { issued: 'issued', returned: 'returned' },
}));

const redisMock = { get: jest.fn() };
const { prisma: prismaMock, tx: txMock, reset } = createPrismaMock();

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
    reset();
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

    it('issues only active orders of the visit', async () => {
      txMock.visit.findFirst.mockResolvedValue({
        id: 1,
        status: 'reserved',
        orders: [{ id: 2, rentPrice: 5000, prepaymentAmount: 1000 }],
      });

      await service.visitIssue(issueData, 1);

      expect(txMock.visit.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: { orders: { where: { deletedAt: null } } },
      });
      expect(txMock.order.update).toHaveBeenCalledTimes(1);
      expect(txMock.order.update).toHaveBeenCalledWith({
        where: { id: 2, deletedAt: null },
        data: { status: 'issued', finalPayment: 0 },
      });
    });

    it('rejects a deleted visit as not found', async () => {
      txMock.visit.findFirst.mockResolvedValue(null);

      await expect(service.visitIssue(issueData, 1)).rejects.toThrow(
        new NotFoundException('Визит с ID 1 не найден'),
      );
      expect(txMock.visit.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: { orders: { where: { deletedAt: null } } },
      });
      expect(txMock.visit.update).not.toHaveBeenCalled();
    });
  });

  describe('orderMarkTagWritten', () => {
    it('returns not found for a deleted order', async () => {
      prismaMock.order.update.mockRejectedValue({ code: 'P2025' });

      await expect(service.orderMarkTagWritten(1)).rejects.toThrow(
        new NotFoundException('Заказ с ID 1 не найден'),
      );
      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        data: { tagStatus: 'written' },
      });
    });
  });

  describe('createVisit', () => {
    const createData = makeCreateVisitRequest() as never;

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
      const data = makeCreateVisitRequest({
        orders: [
          { childId: 2, costumeId: 1, rentPrice: 5000, prepaymentAmount: 0 },
          { childId: 1, costumeId: 3, rentPrice: 5000, prepaymentAmount: 0 },
        ],
      }) as never;

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
        status: { in: ['reserved', 'issued'] },
        AND: [
          { startDateTime: { lt: new Date('2026-12-21') } },
          { endDateTime: { gt: new Date('2026-12-20') } },
        ],
      },
      select: { costume: { select: { id: true, name: true } } },
    });
  });

  it('does not treat returned orders as conflicts when creating a booking', async () => {
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
        status: { in: ['reserved', 'issued'] },
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
        include: {
          orders: { where: { deletedAt: null } },
          deposit: true,
        },
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

  describe('visit order mutations and soft delete', () => {
    it('unissues only active orders', async () => {
      txMock.visit.findFirst.mockResolvedValue({ id: 1, status: 'issued' });

      await service.visitUnissue(1);

      expect(txMock.order.updateMany).toHaveBeenCalledWith({
        where: { visitId: 1, deletedAt: null },
        data: { status: 'reserved', finalPayment: null },
      });
    });

    it('completes return using only active orders', async () => {
      prismaMock.visit.findFirst.mockResolvedValue({
        id: 1,
        visitCode: '1234',
        status: 'issued',
        notes: null,
        orders: [],
        deposit: null,
      });
      txMock.visit.update.mockResolvedValue({
        id: 1,
        visitCode: '1234',
        status: 'completed',
      });

      await service.visitCompleteReturn(1, {
        depositReturned: false,
      } as never);

      expect(prismaMock.visit.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: {
          orders: { where: { deletedAt: null } },
          deposit: true,
        },
      });
      expect(txMock.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { visitId: 1, deletedAt: null },
        }),
      );
    });

    it('cancels only active orders', async () => {
      prismaMock.visit.findFirst.mockResolvedValue({
        id: 1,
        status: 'reserved',
        notes: null,
      });

      await service.visitCancel(1, {} as never);

      expect(txMock.order.updateMany).toHaveBeenCalledWith({
        where: { visitId: 1, deletedAt: null },
        data: { status: 'cancelled' },
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

  describe('visit list soft delete filters', () => {
    it('filters deleted visits and orders from reserved visits', async () => {
      prismaMock.visit.findMany.mockResolvedValue([]);
      prismaMock.visit.count.mockResolvedValue(0);

      await service.visitReserved();

      expect(prismaMock.visit.findMany).toHaveBeenCalledWith({
        where: { status: 'reserved', deletedAt: null },
        include: {
          client: true,
          orders: {
            where: { deletedAt: null },
            include: { child: true, costume: true },
          },
        },
        orderBy: { startDateTime: 'asc' },
        take: 20,
        skip: 0,
      });
      expect(prismaMock.visit.count).toHaveBeenCalledWith({
        where: { status: 'reserved', deletedAt: null },
      });
    });

    it('does not find a deleted visit for issue', async () => {
      prismaMock.visit.findUnique.mockResolvedValue({
        id: 1,
        visitCode: '0001',
        client: { name: 'Алия', phone: '+77001234567' },
        startDateTime: new Date('2026-12-20T10:00:00Z'),
        endDateTime: new Date('2026-12-21T10:00:00Z'),
        issueTimeFrom: '10:00',
        issueTimeTo: '11:00',
        returnTimeUntil: '10:00',
        orders: [],
        notes: null,
        deletedAt: new Date('2026-12-01T00:00:00Z'),
      } as never);
      prismaMock.visit.findFirst.mockResolvedValue(null);

      await expect(service.visitForIssue(1)).rejects.toThrow(
        new NotFoundException('Визит с ID 1 не найден'),
      );
      expect(prismaMock.visit.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: {
          client: true,
          orders: {
            where: { deletedAt: null },
            include: { child: true, costume: true },
          },
        },
      });
    });

    it('filters deleted visits and orders from unreturned deposits', async () => {
      prismaMock.$transaction.mockImplementation(
        (operations: Promise<unknown>[]) => Promise.all(operations),
      );
      prismaMock.visit.count.mockResolvedValue(0);
      prismaMock.visit.findMany.mockResolvedValue([]);

      await service.visitUnreturnedDeposits();

      expect(prismaMock.visit.findMany).toHaveBeenCalledWith({
        where: {
          status: 'completed',
          deletedAt: null,
          deposit: { returned: false, type: { not: 'none' } },
        },
        skip: 0,
        take: 20,
        orderBy: { endDateTime: 'desc' },
        include: {
          client: true,
          deposit: true,
          orders: {
            where: { deletedAt: null },
            include: { child: true, costume: true },
          },
        },
      });
      expect(prismaMock.visit.count).toHaveBeenCalledWith({
        where: {
          status: 'completed',
          deletedAt: null,
          deposit: { returned: false, type: { not: 'none' } },
        },
      });
    });

    it('filters deleted visits and orders from issued visits', async () => {
      prismaMock.$transaction.mockImplementation(
        (operations: Promise<unknown>[]) => Promise.all(operations),
      );
      prismaMock.visit.count.mockResolvedValue(0);
      prismaMock.visit.findMany.mockResolvedValue([]);

      await service.visitIssued();

      expect(prismaMock.visit.findMany).toHaveBeenCalledWith({
        where: { status: 'issued', deletedAt: null },
        skip: 0,
        take: 20,
        orderBy: { endDateTime: 'asc' },
        include: {
          client: true,
          deposit: true,
          orders: {
            where: { deletedAt: null },
            include: { child: true, costume: true },
          },
        },
      });
      expect(prismaMock.visit.count).toHaveBeenCalledWith({
        where: { status: 'issued', deletedAt: null },
      });
    });

    it('filters deleted visits and orders from visits issued for return', async () => {
      prismaMock.visit.findMany.mockResolvedValue([]);

      await service.visitsIssuedForReturn();

      expect(prismaMock.visit.findMany).toHaveBeenCalledWith({
        where: { status: 'issued', deletedAt: null },
        include: {
          client: true,
          orders: {
            where: { deletedAt: null },
            include: { child: true, costume: true },
          },
        },
      });
    });

    it('filters deleted orders from visit search results', async () => {
      prismaMock.visit.findMany.mockResolvedValue([]);

      await service.visitSearch('Алия');

      const visitQueries = prismaMock.visit.findMany.mock
        .calls as unknown as unknown[];
      const query = (visitQueries[0] as unknown[])[0] as {
        where: { status: string; deletedAt: null; OR?: unknown };
        include: {
          orders: {
            where: { deletedAt: null };
          };
        };
      };
      expect(query.where.status).toBe('reserved');
      expect(query.where.deletedAt).toBeNull();
      expect(Array.isArray(query.where.OR)).toBe(true);
      expect(query.include.orders.where).toEqual({ deletedAt: null });
    });

    it('filters deleted orders from notification search results', async () => {
      prismaMock.notification.findMany.mockResolvedValue([]);

      await service.searchNotification('Алия');

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            visit: {
              include: {
                client: true,
                orders: {
                  where: { deletedAt: null },
                  include: { child: true, costume: true },
                },
              },
            },
          },
        }),
      );
    });

    it('counts and lists notifications only for active visits', async () => {
      prismaMock.$transaction.mockImplementation(
        (operations: Promise<unknown>[]) => Promise.all(operations),
      );
      prismaMock.notification.count.mockResolvedValue(0);
      prismaMock.notification.findMany.mockResolvedValue([]);

      await service.visitNotification();

      expect(prismaMock.notification.count).toHaveBeenNthCalledWith(1, {
        where: { visit: { deletedAt: null } },
      });
      const countCalls = prismaMock.notification.count.mock
        .calls as unknown as unknown[];
      const todayFilter = (countCalls[1] as unknown[])[0] as {
        where: {
          visit: { deletedAt: null };
          createdAt: { gte: Date };
        };
      };
      expect(todayFilter.where.visit).toEqual({ deletedAt: null });
      expect(todayFilter.where.createdAt.gte).toBeInstanceOf(Date);
      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        where: { visit: { deletedAt: null } },
        orderBy: { createdAt: 'desc' },
        include: {
          visit: {
            include: {
              client: true,
              orders: {
                where: { deletedAt: null },
                include: { child: true, costume: true },
              },
            },
          },
        },
      });
    });
  });
});
