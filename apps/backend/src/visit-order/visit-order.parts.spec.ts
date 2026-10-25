import { BadRequestException } from '@nestjs/common';
import { VisitOrderService } from './visit-order.service';
import {
  createPrismaMock,
  makeChild,
  makeCostume,
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

const systemAuditActor = { source: 'system' } as const;
const { prisma: prismaMock, tx: txMock, reset } = createPrismaMock();

const hat = { name: 'Головной убор', qty: 1 };
const cape = { name: 'Накидка', qty: 1 };

const orderWithParts = (
  overrides: Record<string, unknown> = {},
  costumeParts: unknown = [hat, cape],
) => ({
  ...makeOrder({ id: 1, status: 'issued', ...overrides }),
  child: makeChild({ name: 'Алия' }),
  costume: { ...makeCostume({ name: 'Эльза' }), parts: costumeParts },
});

describe('VisitOrderService costume parts (T-110)', () => {
  let service: VisitOrderService;

  beforeEach(() => {
    reset();
    txMock.visit.updateMany.mockResolvedValue({ count: 1 });
    service = new VisitOrderService(
      { get: jest.fn(), set: jest.fn(), del: jest.fn() } as never,
      { add: jest.fn() } as never,
      prismaMock as never,
      { logger: { id: 'trace-1', error: jest.fn() } } as never,
    );
  });

  describe('issue snapshot', () => {
    it('stores the current costume parts as the issued snapshot', async () => {
      txMock.visit.findFirst.mockResolvedValue({
        ...makeVisit({ status: 'reserved' }),
        orders: [
          orderWithParts({ status: 'reserved' }),
          orderWithParts({ id: 2, status: 'reserved' }, []),
        ],
      });

      await service.visitIssue(
        { additionalPayment: 0, deposit: { type: 'none' } } as never,
        1,
        systemAuditActor,
      );

      expect(txMock.order.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({ issuedParts: [hat, cape] }) as never,
        }) as never,
      );
      expect(txMock.order.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({ issuedParts: [] }) as never,
        }) as never,
      );
    });

    it('does not fail the issue on a corrupted costume parts value', async () => {
      txMock.visit.findFirst.mockResolvedValue({
        ...makeVisit({ status: 'reserved' }),
        orders: [orderWithParts({ status: 'reserved' }, 'шапка')],
      });

      await service.visitIssue(
        { additionalPayment: 0, deposit: { type: 'none' } } as never,
        1,
        systemAuditActor,
      );

      expect(txMock.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ issuedParts: [] }) as never,
        }) as never,
      );
    });
  });

  describe('visit read for issue and return', () => {
    it('shows the current costume parts as a hint on issue', async () => {
      prismaMock.visit.findFirst.mockResolvedValue({
        ...makeVisit(),
        client: { name: 'Алия', phone: '+77071111111' },
        orders: [orderWithParts({ status: 'reserved' })],
      });

      const result = await service.visitForIssue(1);

      expect(result.orders[0].parts).toEqual([hat, cape]);
    });

    it('shows the issued snapshot on return even if the costume changed since', async () => {
      prismaMock.visit.findFirst.mockResolvedValue({
        ...makeVisit({ status: 'issued' }),
        client: { name: 'Алия', phone: '+77071111111' },
        deposits: [],
        moneyOperations: [],
        orders: [orderWithParts({ issuedParts: [hat] }, [hat, cape])],
      });

      const result = await service.visitsForReturn(1);

      expect(result.orders[0].parts).toEqual([hat]);
    });

    it('falls back to the current costume parts for an order without a snapshot', async () => {
      prismaMock.visit.findFirst.mockResolvedValue({
        ...makeVisit({ status: 'issued' }),
        client: { name: 'Алия', phone: '+77071111111' },
        deposits: [],
        moneyOperations: [],
        orders: [orderWithParts({ issuedParts: null })],
      });

      const result = await service.visitsForReturn(1);

      expect(result.orders[0].parts).toEqual([hat, cape]);
    });
  });

  describe('complete return with missing parts', () => {
    const issuedVisit = (
      orders = [orderWithParts({ issuedParts: [hat, cape] })],
    ) =>
      txMock.visit.findFirst.mockResolvedValue({
        ...makeVisit({ status: 'issued', visitCode: '1234' }),
        orders,
        deposits: [makeDeposit({ type: 'document' })],
        moneyOperations: [],
      });

    const auditActions = () =>
      (
        txMock.auditEvent.create.mock.calls as [
          { data: { action: string; payload: Record<string, unknown> } },
        ][]
      ).map(([call]) => call.data);

    it('records the missing parts in the history without blocking the return', async () => {
      issuedVisit();

      await service.visitCompleteReturn(
        1,
        {
          depositReturned: false,
          missingParts: [{ orderId: 1, parts: ['накидка'] }],
        },
        systemAuditActor,
      );

      expect(txMock.order.updateMany).toHaveBeenCalledWith({
        where: { visitId: 1, deletedAt: null },
        data: { status: 'returned' },
      });
      expect(txMock.visitMoneyOperation.create).not.toHaveBeenCalled();
      const events = auditActions();
      expect(events.map((event) => event.action)).toEqual([
        'visit.completed',
        'return.missing_parts',
      ]);
      expect(events[1]).toMatchObject({
        entityType: 'order',
        entityId: 1,
        orderId: 1,
        payload: {
          kind: 'return.missing_parts',
          visitCode: '1234',
          orderId: 1,
          childName: 'Алия',
          costumeName: 'Эльза',
          parts: ['Накидка'],
        },
      });
    });

    it('writes no extra events when nothing is missing', async () => {
      issuedVisit();

      await service.visitCompleteReturn(
        1,
        { depositReturned: false, missingParts: [] },
        systemAuditActor,
      );

      expect(auditActions().map((event) => event.action)).toEqual([
        'visit.completed',
      ]);
    });

    it('rejects an order from another visit and writes nothing', async () => {
      issuedVisit();

      await expect(
        service.visitCompleteReturn(
          1,
          {
            depositReturned: false,
            missingParts: [{ orderId: 99, parts: ['Накидка'] }],
          },
          systemAuditActor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(txMock.order.updateMany).not.toHaveBeenCalled();
      expect(txMock.visit.updateMany).not.toHaveBeenCalled();
      expect(txMock.auditEvent.create).not.toHaveBeenCalled();
    });

    it('rejects a part that is not in the issued snapshot', async () => {
      // В костюм потом добавили «Накидку», но выдавали без неё
      issuedVisit([orderWithParts({ issuedParts: [hat] }, [hat, cape])]);

      await expect(
        service.visitCompleteReturn(
          1,
          {
            depositReturned: false,
            missingParts: [{ orderId: 1, parts: ['Накидка'] }],
          },
          systemAuditActor,
        ),
      ).rejects.toThrow('Части «Накидка» нет в составе костюма «Эльза»');
      expect(txMock.auditEvent.create).not.toHaveBeenCalled();
    });

    it('rejects the same order listed twice', async () => {
      issuedVisit();

      await expect(
        service.visitCompleteReturn(
          1,
          {
            depositReturned: false,
            missingParts: [
              { orderId: 1, parts: ['Накидка'] },
              { orderId: 1, parts: ['Головной убор'] },
            ],
          },
          systemAuditActor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(txMock.order.updateMany).not.toHaveBeenCalled();
    });
  });
});
