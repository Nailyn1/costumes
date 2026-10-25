import { NotFoundException } from '@nestjs/common';
import { VisitReadDetailDto, VisitReadDetailSchema } from '@costumes/shared';
import { Prisma } from '../prisma/generated/client';
import { calculateVisitBalance } from './domain/visit-balance';
import type { CostumePhotosService } from '../costume-photos/costume-photos.service';

type VisitReadDatabase = Pick<Prisma.TransactionClient, 'visit'>;

/** Build and validate the canonical detail response using the caller's database client. */
export async function readVisitDetail(
  db: VisitReadDatabase,
  visitId: number,
  photos: Pick<CostumePhotosService, 'summaries'>,
): Promise<VisitReadDetailDto> {
  const visit = await db.visit.findFirst({
    where: { id: visitId, deletedAt: null },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      orders: {
        where: { deletedAt: null },
        include: {
          child: { select: { name: true } },
          costume: { select: { name: true, inventoryCode: true } },
        },
      },
      moneyOperations: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
      deposits: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });
  if (!visit) throw new NotFoundException(`Визит с ID ${visitId} не найден`);

  const totalRent = visit.orders.reduce(
    (sum, order) => sum + order.rentPrice,
    0,
  );
  const totalPrepayment = visit.orders.reduce(
    (sum, order) => sum + order.prepaymentAmount,
    0,
  );
  const balance =
    visit.status === 'issued' || visit.status === 'completed'
      ? calculateVisitBalance({
          orders: visit.orders,
          operations: visit.moneyOperations,
        })
      : undefined;

  const summaries = await photos.summaries(
    visit.orders.map((order) => order.costumeId),
  );

  return VisitReadDetailSchema.parse({
    id: visit.id,
    visitCode: visit.visitCode,
    status: visit.status,
    version: visit.version,
    client: visit.client,
    startDateTime: visit.startDateTime.toISOString().slice(0, 10),
    endDateTime: visit.endDateTime.toISOString().slice(0, 10),
    issueTimeFrom: visit.issueTimeFrom,
    issueTimeTo: visit.issueTimeTo,
    returnTimeUntil: visit.returnTimeUntil,
    ...(visit.notes === null ? {} : { notes: visit.notes }),
    createdAt: visit.createdAt.toISOString(),
    orders: visit.orders.map((order) => ({
      orderId: order.id,
      childId: order.childId,
      childName: order.child.name,
      costumeId: order.costumeId,
      costumeName: order.costume.name,
      inventoryCode: order.costume.inventoryCode,
      photoCount: 0,
      ...summaries.get(order.costumeId),
      status: order.status,
      tagStatus: order.tagStatus,
      rentPrice: order.rentPrice,
      prepaymentAmount: order.prepaymentAmount,
      ...(order.finalPayment === null
        ? {}
        : { finalPayment: order.finalPayment }),
      ...(order.notes === null ? {} : { notes: order.notes }),
    })),
    moneyOperations: visit.moneyOperations.map((operation) => ({
      id: operation.id,
      kind: operation.kind,
      amount: operation.amount,
      createdAt: operation.createdAt.toISOString(),
      legacyImported: operation.legacyImported,
      ...(operation.voidedAt === null
        ? {}
        : { voidedAt: operation.voidedAt.toISOString() }),
    })),
    deposits: visit.deposits.map((deposit) => ({
      id: deposit.id,
      type: deposit.type,
      ...(deposit.amount === null ? {} : { amount: deposit.amount }),
      returned: deposit.returned,
      createdAt: deposit.createdAt.toISOString(),
    })),
    totals: {
      totalRent,
      totalPrepayment,
      totalRemaining: totalRent - totalPrepayment,
    },
    ...(balance ? { balance } : {}),
  });
}
