import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VisitOrderService } from './visit-order.service';
import { Prisma } from '../prisma/generated/client';

import {
  createPrismaMock,
  makeChild,
  makeClient,
  makeCostume,
  makeCreateVisitRequest,
  makeDeposit,
  makeOrder,
  makeVisit,
} from '../test-utils';

jest.mock('../prisma/generated/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code = '';
    },
  },
  OrderStatus: { issued: 'issued', returned: 'returned' },
  VisitStatus: { completed: 'completed' },
}));

const redisMock = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
const queueMock = { add: jest.fn() };
const loggerMock = { logger: { id: 'trace-1', error: jest.fn() } };
const { prisma: prismaMock, tx: txMock, reset } = createPrismaMock();

const createService = () =>
  new VisitOrderService(
    redisMock as never,
    queueMock as never,
    prismaMock as never,
    loggerMock as never,
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

      await expect(service.visitCancel(1, {})).rejects.toThrow(
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
          deposits: { where: { deletedAt: null }, take: 1 },
          moneyOperations: { where: { voidedAt: null } },
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
        include: { deposits: { where: { deletedAt: null }, take: 1 } },
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
        deposits: [],
      });
      txMock.visit.update.mockResolvedValue({
        id: 1,
        visitCode: '1234',
        status: 'completed',
      });

      await service.visitCompleteReturn(1, {
        depositReturned: false,
      });

      expect(prismaMock.visit.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: {
          orders: { where: { deletedAt: null } },
          deposits: { where: { deletedAt: null }, take: 1 },
          moneyOperations: { where: { voidedAt: null } },
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

      await service.visitCancel(1, {});

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
      });
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
          deposits: {
            some: { deletedAt: null, returned: false, type: { not: 'none' } },
          },
        },
        skip: 0,
        take: 20,
        orderBy: { endDateTime: 'desc' },
        include: {
          client: true,
          deposits: { where: { deletedAt: null }, take: 1 },
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
          deposits: {
            some: { deletedAt: null, returned: false, type: { not: 'none' } },
          },
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
          deposits: { where: { deletedAt: null }, take: 1 },
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

describe('VisitOrderService remaining business rules', () => {
  let service: VisitOrderService;

  beforeEach(() => {
    reset();
    service = createService();
  });

  describe('booking validation and code reservation', () => {
    const prepareValidBooking = (
      notifications: Record<string, unknown>[] = [],
    ) => {
      redisMock.get.mockResolvedValue('reserved');
      txMock.client.findFirst.mockResolvedValue(makeClient());
      txMock.child.findMany.mockResolvedValue([makeChild()]);
      txMock.costume.findMany.mockResolvedValue([makeCostume()]);
      txMock.order.findMany.mockResolvedValue([]);
      txMock.visit.create.mockResolvedValue({
        ...makeVisit({
          startDateTime: new Date('2026-12-20T18:30:00Z'),
          endDateTime: new Date('2026-12-21T18:00:00Z'),
          issueTimeFrom: '18:30',
          returnTimeUntil: '18:00',
        }),
        client: makeClient(),
        notifications,
        orders: [
          {
            ...makeOrder({ prepaymentAmount: 5000 }),
            child: makeChild(),
            costume: makeCostume(),
          },
        ],
      });
    };

    it('rejects duplicate costumes in one booking before reading or writing', async () => {
      const data = makeCreateVisitRequest({
        orders: [
          { childId: 1, costumeId: 1, rentPrice: 5000, prepaymentAmount: 1000 },
          { childId: 2, costumeId: 1, rentPrice: 5000, prepaymentAmount: 1000 },
        ],
      });
      await expect(service.createVisit(data as never, false)).rejects.toThrow(
        'один костюм указан в нескольких заказах',
      );
      expect(redisMock.get).not.toHaveBeenCalled();
      expect(txMock.visit.create).not.toHaveBeenCalled();
    });

    it('accepts different costumes in one booking', async () => {
      prepareValidBooking();
      txMock.child.findMany.mockResolvedValue([
        makeChild(),
        makeChild({ id: 2 }),
      ]);
      txMock.costume.findMany.mockResolvedValue([
        makeCostume(),
        makeCostume({ id: 2 }),
      ]);
      await service.createVisit(
        makeCreateVisitRequest({
          orders: [
            {
              childId: 1,
              costumeId: 1,
              rentPrice: 5000,
              prepaymentAmount: 1000,
            },
            {
              childId: 2,
              costumeId: 2,
              rentPrice: 5000,
              prepaymentAmount: 1000,
            },
          ],
        }),
        false,
      );
      expect(txMock.visit.create).toHaveBeenCalledTimes(1);
      const createCalls = txMock.visit.create.mock.calls as unknown as Array<
        [{ data: { orders: { create: { costumeId: number }[] } } }]
      >;
      expect(
        createCalls[0][0].data.orders.create.map((o) => o.costumeId),
      ).toEqual([1, 2]);
    });

    it('accepts full prepayment, stores local time as UTC and releases the code lock', async () => {
      prepareValidBooking();
      const data = makeCreateVisitRequest({
        issueTimeFrom: '18:30',
        returnTimeUntil: '18:00',
        orders: [
          { childId: 1, costumeId: 1, rentPrice: 5000, prepaymentAmount: 5000 },
        ],
      });
      await service.createVisit(data, false);
      const createCalls = txMock.visit.create.mock.calls as unknown as Array<
        [{ data: { startDateTime: Date; endDateTime: Date } }]
      >;
      const createArg = createCalls[0][0];
      expect(createArg.data.startDateTime).toEqual(
        new Date('2026-12-20T18:30:00Z'),
      );
      expect(createArg.data.endDateTime).toEqual(
        new Date('2026-12-21T18:00:00Z'),
      );
      expect(redisMock.del).toHaveBeenCalledWith('visit_code_lock:1234');
      expect(queueMock.add).not.toHaveBeenCalled();
    });

    it('creates a pending notification and enqueues the named job', async () => {
      prepareValidBooking([
        {
          id: 9,
          type: 'booking_confirmation',
          status: 'pending',
          traceId: 'trace-1',
          createdAt: new Date('2026-12-01T00:00:00Z'),
        },
      ]);
      await service.createVisit(
        makeCreateVisitRequest({
          issueTimeFrom: '18:30',
          returnTimeUntil: '18:00',
        }),
        true,
      );
      const createCalls = txMock.visit.create.mock.calls as unknown as Array<
        [
          {
            data: {
              notifications: {
                create: { type: string; status: string; traceId: string };
              };
            };
          },
        ]
      >;
      const createArg = createCalls[0][0];
      expect(createArg.data.notifications.create).toEqual({
        type: 'booking_confirmation',
        status: 'pending',
        traceId: 'trace-1',
      });
      expect(queueMock.add).toHaveBeenCalledWith(
        'send-whatsapp',
        { notificationId: 9, traceId: 'trace-1' },
        { jobId: 'notification-9' },
      );
    });

    it('keeps the visit when queue submission fails', async () => {
      prepareValidBooking([
        {
          id: 9,
          type: 'booking_confirmation',
          status: 'pending',
          traceId: 'trace-1',
          createdAt: new Date('2026-12-01T00:00:00Z'),
        },
      ]);
      queueMock.add.mockRejectedValue(new Error('queue unavailable'));
      await expect(
        service.createVisit(
          makeCreateVisitRequest({
            issueTimeFrom: '18:30',
            returnTimeUntil: '18:00',
          }) as never,
          true,
        ),
      ).resolves.toMatchObject({ visitCode: '1234' });
      expect(loggerMock.logger.error).toHaveBeenCalled();
    });

    it('turns a foreign-key error into a bad request', async () => {
      prepareValidBooking();
      const error = new Prisma.PrismaClientKnownRequestError('foreign key', {
        code: 'P2003',
        clientVersion: '7',
      });
      error.code = 'P2003';
      txMock.visit.create.mockRejectedValue(error);
      await expect(
        service.createVisit(makeCreateVisitRequest() as never, false),
      ).rejects.toMatchObject({ status: 400 });
    });
    it('rejects dates in reverse order before reading the reservation', async () => {
      await expect(
        service.createVisit(
          makeCreateVisitRequest({
            startDateTime: '2026-12-22',
            endDateTime: '2026-12-20',
          }) as never,
          false,
        ),
      ).rejects.toThrow('Дата начала не может быть позже даты возврата');
      expect(redisMock.get).not.toHaveBeenCalled();
    });

    it('rejects missing code reservation', async () => {
      redisMock.get.mockResolvedValue(null);
      await expect(
        service.createVisit(makeCreateVisitRequest() as never, false),
      ).rejects.toMatchObject({ status: 409 });
      expect(txMock.visit.create).not.toHaveBeenCalled();
    });

    it('rejects prepayment above rent before writing a visit', async () => {
      redisMock.get.mockResolvedValue('reserved');
      const data = makeCreateVisitRequest({
        orders: [
          { childId: 1, costumeId: 1, rentPrice: 5000, prepaymentAmount: 5001 },
        ],
      });
      await expect(
        service.createVisit(data as never, false),
      ).rejects.toMatchObject({ status: 400 });
      expect(txMock.visit.create).not.toHaveBeenCalled();
    });

    it('generates four digits, skips Redis and database collisions and reserves for 15 minutes', async () => {
      const random = jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.0001)
        .mockReturnValueOnce(0.0002)
        .mockReturnValueOnce(0.1234);
      try {
        redisMock.get.mockResolvedValueOnce('reserved').mockResolvedValue(null);
        prismaMock.visit.findUnique
          .mockResolvedValueOnce({ id: 1 })
          .mockResolvedValueOnce(null);
        redisMock.set.mockResolvedValue('OK');
        await expect(service.generatePreviewCode()).resolves.toBe('1234');
        expect(redisMock.set).toHaveBeenCalledWith(
          'visit_code_lock:1234',
          'reserved',
          'EX',
          900,
          'NX',
        );
      } finally {
        random.mockRestore();
      }
    });

    it('stops after ten unsuccessful code attempts', async () => {
      redisMock.get.mockResolvedValue('reserved');
      await expect(service.generatePreviewCode()).rejects.toMatchObject({
        status: 500,
      });
      expect(redisMock.get).toHaveBeenCalledTimes(10);
      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('uses strict overlap boundaries and returns each busy costume once', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { costume: { id: 1, name: 'Эльза' } },
        { costume: { id: 1, name: 'Эльза' } },
      ]);
      const start = new Date('2026-12-20T10:00:00Z');
      const end = new Date('2026-12-21T10:00:00Z');
      await expect(
        service.isSuitAvailability([1, 2], start, end),
      ).resolves.toEqual([{ id: 1, name: 'Эльза' }]);
      expect(prismaMock.order.findMany).toHaveBeenCalledWith({
        where: {
          costumeId: { in: [1, 2] },
          deletedAt: null,
          status: { in: ['reserved', 'issued'] },
          AND: [{ startDateTime: { lt: end } }, { endDateTime: { gt: start } }],
        },
        select: { costume: { select: { id: true, name: true } } },
      });
    });
  });

  describe('tags and lists', () => {
    it('marks an active order written', async () => {
      prismaMock.order.update.mockResolvedValue({ id: 5 });
      await service.orderMarkTagWritten(5);
      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 5, deletedAt: null },
        data: { tagStatus: 'written' },
      });
    });

    it('paginates reserved visits and applies an inclusive day filter', async () => {
      prismaMock.visit.findMany.mockResolvedValue([]);
      prismaMock.visit.count.mockResolvedValue(5);
      await expect(
        service.visitReserved('2026-12-20', '2026-12-21', 2, 2),
      ).resolves.toEqual({
        items: [],
        total: 5,
        page: 2,
        limit: 2,
        hasMore: true,
      });
      const calls = prismaMock.visit.findMany.mock.calls as unknown as Array<
        [
          {
            where: {
              status: string;
              deletedAt: null;
              startDateTime: { gte: Date; lte: Date };
            };
            take: number;
            skip: number;
          },
        ]
      >;
      const query = calls[0][0];
      expect(query.where.status).toBe('reserved');
      expect(query.where.deletedAt).toBeNull();
      expect(query.where.startDateTime.gte.getDate()).toBe(20);
      expect(query.where.startDateTime.gte.getHours()).toBe(0);
      expect(query.where.startDateTime.lte.getDate()).toBe(21);
      expect(query.where.startDateTime.lte.getHours()).toBe(23);
      expect(query.take).toBe(2);
      expect(query.skip).toBe(2);
    });

    it('rejects reversed reserved-list dates', async () => {
      await expect(
        service.visitReserved('2026-12-21', '2026-12-20'),
      ).rejects.toMatchObject({ status: 400 });
      expect(prismaMock.visit.findMany).not.toHaveBeenCalled();
    });

    it('does not search for one-character visit or return query', async () => {
      await expect(service.visitSearch('А')).resolves.toEqual([]);
      await expect(service.visitsReturnSearch('А')).resolves.toEqual([]);
      expect(prismaMock.visit.findMany).not.toHaveBeenCalled();
    });
  });

  describe('issue and unissue', () => {
    it('records the full overpayment even when order allocation is capped', async () => {
      txMock.visit.findFirst.mockResolvedValue({
        ...makeVisit(),
        orders: [makeOrder({ id: 1, rentPrice: 5000, prepaymentAmount: 1000 })],
      });
      await service.visitIssue(
        { additionalPayment: 5000, deposit: { type: 'none' } } as never,
        1,
      );
      expect(txMock.order.update).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        data: { status: 'issued', finalPayment: 4000 },
      });
      expect(txMock.visitMoneyOperation.create).toHaveBeenCalledWith({
        data: { visitId: 1, kind: 'issue_payment', amount: 5000 },
      });
    });
    it('allocates payment, records a cash deposit and appends issue notes', async () => {
      txMock.visit.findFirst.mockResolvedValue({
        ...makeVisit({ notes: 'старое' }),
        orders: [
          makeOrder({ id: 1, rentPrice: 5000, prepaymentAmount: 1000 }),
          makeOrder({ id: 2, rentPrice: 3000, prepaymentAmount: 1000 }),
        ],
      });
      await service.visitIssue(
        {
          additionalPayment: 6000,
          deposit: { type: 'cash', amount: 5000 },
          notes: 'новое',
        } as never,
        1,
      );
      expect(txMock.order.update).toHaveBeenNthCalledWith(1, {
        where: { id: 1, deletedAt: null },
        data: { status: 'issued', finalPayment: 4000 },
      });
      expect(txMock.order.update).toHaveBeenNthCalledWith(2, {
        where: { id: 2, deletedAt: null },
        data: { status: 'issued', finalPayment: 2000 },
      });
      expect(txMock.visit.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'issued', notes: 'старое\nновое' },
      });
      expect(txMock.deposit.create).toHaveBeenCalledWith({
        data: { visitId: 1, type: 'cash', amount: 5000, returned: false },
      });
      expect(txMock.visitMoneyOperation.create).toHaveBeenCalledWith({
        data: { visitId: 1, kind: 'issue_payment', amount: 6000 },
      });
    });

    it.each(['document', 'none'])(
      'records %s deposit without an amount',
      async (type) => {
        txMock.visit.findFirst.mockResolvedValue({
          ...makeVisit(),
          orders: [],
        });
        await service.visitIssue(
          { additionalPayment: 0, deposit: { type } } as never,
          1,
        );
        expect(txMock.deposit.create).toHaveBeenCalledWith({
          data: { visitId: 1, type, amount: 0, returned: false },
        });
        expect(txMock.visitMoneyOperation.create).not.toHaveBeenCalled();
      },
    );

    it('propagates a transaction error before a deposit is written', async () => {
      txMock.visit.findFirst.mockResolvedValue({
        ...makeVisit(),
        orders: [makeOrder()],
      });
      txMock.order.update.mockRejectedValue(new Error('database failure'));
      await expect(
        service.visitIssue(
          { additionalPayment: 1, deposit: { type: 'none' } } as never,
          1,
        ),
      ).rejects.toThrow('database failure');
      expect(txMock.visit.update).not.toHaveBeenCalled();
      expect(txMock.deposit.create).not.toHaveBeenCalled();
    });

    it('unissues orders, clears payment and soft-deletes the active deposit (T-026)', async () => {
      txMock.visit.findFirst.mockResolvedValue(makeVisit({ status: 'issued' }));
      await service.visitUnissue(1);
      expect(txMock.order.updateMany).toHaveBeenCalledWith({
        where: { visitId: 1, deletedAt: null },
        data: { status: 'reserved', finalPayment: null },
      });
      expect(txMock.visit.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'reserved' },
      });
      expect(txMock.deposit.updateMany).toHaveBeenCalledWith({
        where: { visitId: 1, deletedAt: null },
        data: { deletedAt: expect.any(Date) as Date },
      });
      expect(txMock.visitMoneyOperation.updateMany).toHaveBeenCalledWith({
        where: { visitId: 1, kind: 'issue_payment', voidedAt: null },
        data: { voidedAt: expect.any(Date) as Date },
      });
    });

    it('rejects unissue unless the visit is issued', async () => {
      txMock.visit.findFirst.mockResolvedValue(makeVisit());
      await expect(service.visitUnissue(1)).rejects.toMatchObject({
        status: 400,
      });
      expect(txMock.order.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('return, cancellation and deposit', () => {
    it.todo('T-027: allow a partial return after business rules are defined');

    it.each(['reserved', 'issued', 'cancelled'] as const)(
      'rejects deposit return for %s visit',
      async (status) => {
        prismaMock.visit.findFirst.mockResolvedValue({
          ...makeVisit({ status }),
          deposits: [makeDeposit({ type: 'cash' })],
        });
        await expect(service.MarkDepositReturned(1)).rejects.toThrow(
          'Вернуть залог можно только после завершения визита',
        );
        expect(txMock.deposit.update).not.toHaveBeenCalled();
      },
    );

    it('rejects a completed visit without a real deposit', async () => {
      prismaMock.visit.findFirst.mockResolvedValue({
        ...makeVisit({ status: 'completed' }),
        deposits: [makeDeposit({ type: 'none' })],
      });
      await expect(service.MarkDepositReturned(1)).rejects.toThrow(
        'У визита нет залога для возврата',
      );
      expect(txMock.deposit.update).not.toHaveBeenCalled();
    });

    it('reports a missing visit as 404 before changing a deposit', async () => {
      prismaMock.visit.findFirst.mockResolvedValue(null);
      await expect(service.MarkDepositReturned(1)).rejects.toMatchObject({
        status: 404,
      });
      expect(txMock.deposit.update).not.toHaveBeenCalled();
    });

    it('returns a document deposit after completion', async () => {
      prismaMock.visit.findFirst.mockResolvedValue({
        ...makeVisit({ status: 'completed' }),
        deposits: [makeDeposit({ type: 'document' })],
      });
      await expect(service.MarkDepositReturned(1)).resolves.toMatchObject({
        depositReturned: true,
      });
      expect(txMock.deposit.update).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        data: { returned: true },
      });
    });

    it('allows an idempotent repeated deposit return and appends a note', async () => {
      prismaMock.visit.findFirst.mockResolvedValue({
        ...makeVisit({ status: 'completed', notes: 'старое' }),
        deposits: [makeDeposit({ type: 'cash', returned: true })],
      });
      const result = await service.MarkDepositReturned(1, 'проверили');
      expect(result.depositReturned).toBe(true);
      expect(txMock.deposit.update).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        data: { returned: true },
      });
      expect(txMock.visit.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { notes: 'старое\n[Возврат залога]: проверили' },
      });
    });
    it('rejects a non-issued visit and an order with an invalid status', async () => {
      prismaMock.visit.findFirst
        .mockResolvedValueOnce({ ...makeVisit(), orders: [], deposits: [] })
        .mockResolvedValueOnce({
          ...makeVisit({ status: 'issued' }),
          orders: [makeOrder()],
          deposits: [],
        });
      await expect(
        service.visitCompleteReturn(1, { depositReturned: false }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.visitCompleteReturn(1, { depositReturned: false }),
      ).rejects.toMatchObject({ status: 400 });
      expect(txMock.order.updateMany).not.toHaveBeenCalled();
    });

    it('returns all orders and appends a comment without requiring deposit return', async () => {
      prismaMock.visit.findFirst.mockResolvedValue({
        ...makeVisit({ status: 'issued', notes: 'старое' }),
        orders: [makeOrder({ status: 'issued' })],
        deposits: [makeDeposit({ type: 'cash', returned: false })],
      });
      txMock.visit.update.mockResolvedValue(makeVisit({ status: 'completed' }));
      await service.visitCompleteReturn(1, {
        depositReturned: false,
        notes: 'всё цело',
      });
      expect(txMock.order.updateMany).toHaveBeenCalledWith({
        where: { visitId: 1, deletedAt: null },
        data: { status: 'returned' },
      });
      expect(txMock.deposit.update).not.toHaveBeenCalled();
      expect(txMock.visit.update).toHaveBeenCalledWith({
        where: { id: 1, status: 'issued', deletedAt: null },
        data: { status: 'completed', notes: 'старое\n[Завершение]: всё цело' },
      });
    });

    it('marks the deposit returned when completing a visit', async () => {
      prismaMock.visit.findFirst.mockResolvedValue({
        ...makeVisit({ status: 'issued' }),
        orders: [],
        deposits: [makeDeposit({ type: 'cash' })],
      });
      txMock.visit.update.mockResolvedValue(makeVisit({ status: 'completed' }));
      await service.visitCompleteReturn(1, { depositReturned: true });
      expect(txMock.deposit.update).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        data: { returned: true },
      });
    });

    it('cancels a reserved visit and records the reason', async () => {
      prismaMock.visit.findFirst.mockResolvedValue(
        makeVisit({ notes: 'старое' }),
      );
      await service.visitCancel(1, { reason: 'ошибка' });
      expect(txMock.order.updateMany).toHaveBeenCalledWith({
        where: { visitId: 1, deletedAt: null },
        data: { status: 'cancelled' },
      });
      expect(txMock.visit.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'cancelled',
          notes: 'старое\n[Причина отмены]: ошибка',
        },
      });
    });

    it('rejects cancellation of an issued visit', async () => {
      prismaMock.visit.findFirst.mockResolvedValue(
        makeVisit({ status: 'issued' }),
      );
      await expect(service.visitCancel(1, {})).rejects.toMatchObject({
        status: 400,
      });
      expect(txMock.order.updateMany).not.toHaveBeenCalled();
    });
  });
});
