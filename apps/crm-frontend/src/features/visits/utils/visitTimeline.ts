import type {
  VisitHistoryEventDto,
  VisitReadDetailDto,
} from "@costumes/shared";

type MoneyOperation = VisitReadDetailDto["moneyOperations"][number];

// Каждому money-событию соответствует одна операция в той же транзакции.
// Prisma может выставить им разные timestamps: выбираем ближайшую запись
// с теми же kind/amount, строго один к одному. Импорт не имеет аудитного дубля.
export function unmatchedMoneyOperations(
  events: readonly VisitHistoryEventDto[],
  operations: readonly MoneyOperation[],
): MoneyOperation[] {
  const matched = new Set<number>();
  for (const event of events) {
    const payload = event.payload;
    if (payload.kind !== "money.received" && payload.kind !== "money.refunded")
      continue;
    const kind =
      payload.kind === "money.refunded" ? "customer_refund" : payload.moneyKind;
    const candidate = operations
      .filter(
        (operation) =>
          !operation.legacyImported &&
          !matched.has(operation.id) &&
          operation.kind === kind &&
          operation.amount === payload.amount,
      )
      .sort(
        (left, right) =>
          Math.abs(Date.parse(left.createdAt) - Date.parse(event.occurredAt)) -
            Math.abs(
              Date.parse(right.createdAt) - Date.parse(event.occurredAt),
            ) || left.id - right.id,
      )[0];
    if (candidate) matched.add(candidate.id);
  }
  return operations.filter((operation) => !matched.has(operation.id));
}

export function unknownPrepayment(
  events: readonly VisitHistoryEventDto[],
  totalPrepayment: number,
): number {
  const known = events.reduce((sum, event) => {
    const payload = event.payload;
    if (payload.kind === "visit.created")
      return (
        sum +
        payload.orders.reduce(
          (amount, order) => amount + order.prepaymentAmount,
          0,
        )
      );
    if (payload.kind === "visit.updated")
      return (
        sum +
        payload.orderChanges.reduce(
          (amount, change) =>
            amount +
            (change.change === "added"
              ? (change.after?.prepaymentAmount ?? 0)
              : 0),
          0,
        )
      );
    return sum;
  }, 0);
  return Math.max(0, totalPrepayment - known);
}
