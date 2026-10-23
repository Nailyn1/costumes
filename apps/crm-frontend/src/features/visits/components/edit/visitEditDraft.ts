import {
  UpdateReservedVisitRequestSchema,
  type UpdateReservedVisitRequestDto,
  type VisitReadDetailDto,
} from "@costumes/shared";

function toPlainDate(value: string): string {
  return value.slice(0, 10);
}

export type VisitEditOrderDraft = Pick<
  VisitReadDetailDto["orders"][number],
  "prepaymentAmount" | "finalPayment"
> & {
  orderId: number | null;
  childId: number | null;
  costumeId: number | null;
  rentPrice: number | string;
  notes: string;
};

export type VisitEditDraft = Pick<
  VisitReadDetailDto,
  | "startDateTime"
  | "endDateTime"
  | "issueTimeFrom"
  | "issueTimeTo"
  | "returnTimeUntil"
> & {
  notes: string;
  orders: VisitEditOrderDraft[];
};

type VisitEditSource = Pick<
  VisitReadDetailDto,
  | "startDateTime"
  | "endDateTime"
  | "issueTimeFrom"
  | "issueTimeTo"
  | "returnTimeUntil"
  | "notes"
  | "orders"
>;

export function createVisitEditDraft(visit: VisitEditSource): VisitEditDraft {
  return {
    startDateTime: toPlainDate(visit.startDateTime),
    endDateTime: toPlainDate(visit.endDateTime),
    issueTimeFrom: visit.issueTimeFrom,
    issueTimeTo: visit.issueTimeTo,
    returnTimeUntil: visit.returnTimeUntil,
    notes: visit.notes ?? "",
    orders: visit.orders.map((order) => ({
      orderId: order.orderId,
      childId: order.childId,
      costumeId: order.costumeId,
      rentPrice: order.rentPrice,
      prepaymentAmount: order.prepaymentAmount,
      finalPayment: order.finalPayment,
      notes: order.notes ?? "",
    })),
  };
}

export function createVisitEditDraftFromRequest(
  visit: VisitEditSource,
  request: UpdateReservedVisitRequestDto,
): VisitEditDraft {
  const existingOrders = new Map(visit.orders.map((order) => [order.orderId, order]));
  return {
    startDateTime: request.startDateTime,
    endDateTime: request.endDateTime,
    issueTimeFrom: request.issueTimeFrom,
    issueTimeTo: request.issueTimeTo,
    returnTimeUntil: request.returnTimeUntil,
    notes: request.notes ?? "",
    orders: request.orders.map((order) => {
      const existing = order.orderId === undefined
        ? undefined
        : existingOrders.get(order.orderId);
      return {
        orderId: order.orderId ?? null,
        childId: order.childId,
        costumeId: order.costumeId,
        rentPrice: order.rentPrice,
        prepaymentAmount: existing?.prepaymentAmount ?? 0,
        finalPayment: existing?.finalPayment,
        notes: order.notes ?? "",
      };
    }),
  };
}

export function createEmptyVisitEditOrder(): VisitEditOrderDraft {
  return {
    orderId: null,
    childId: null,
    costumeId: null,
    rentPrice: "",
    prepaymentAmount: 0,
    finalPayment: undefined,
    notes: "",
  };
}

export function canRemoveVisitEditOrder(
  order: Pick<VisitEditOrderDraft, "prepaymentAmount">,
  orderCount: number,
): boolean {
  return orderCount > 1 && order.prepaymentAmount === 0;
}

export function isVisitEditPriceValid(
  order: Pick<VisitEditOrderDraft, "rentPrice" | "prepaymentAmount">,
): boolean {
  const rentPrice = Number(order.rentPrice);
  return order.rentPrice !== "" && Number.isFinite(rentPrice) && rentPrice >= order.prepaymentAmount;
}

export function createUpdateReservedVisitRequest(
  draft: VisitEditDraft,
  expectedVersion: number,
  commandId: string,
): UpdateReservedVisitRequestDto {
  return UpdateReservedVisitRequestSchema.parse({
    commandId,
    expectedVersion,
    startDateTime: draft.startDateTime,
    issueTimeFrom: draft.issueTimeFrom,
    issueTimeTo: draft.issueTimeTo,
    endDateTime: draft.endDateTime,
    returnTimeUntil: draft.returnTimeUntil,
    notes: draft.notes,
    orders: draft.orders.map((order) => ({
      ...(order.orderId === null ? {} : { orderId: order.orderId }),
      childId: Number(order.childId),
      costumeId: Number(order.costumeId),
      rentPrice: Number(order.rentPrice),
      notes: order.notes,
    })),
  });
}
