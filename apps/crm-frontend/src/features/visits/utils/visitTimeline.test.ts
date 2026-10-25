import type {
  VisitHistoryEventDto,
  VisitReadDetailDto,
} from "@costumes/shared";
import { describe, expect, it } from "vitest";
import { unmatchedMoneyOperations, unknownPrepayment } from "./visitTimeline";

const instant = "2026-10-25T07:00:00.000Z";
function event(payload: VisitHistoryEventDto["payload"]): VisitHistoryEventDto {
  return {
    id: 1,
    action: payload.kind,
    payload,
    commandId: "command",
    occurredAt: instant,
    actorNameSnapshot: "Алия",
    source: "user",
    entityType: "visit",
    entityId: 1,
    visitId: 1,
    schemaVersion: 1,
  };
}
const payment: VisitReadDetailDto["moneyOperations"][number] = {
  id: 1,
  kind: "issue_payment",
  amount: 1800,
  createdAt: instant,
  legacyImported: false,
};

describe("combined visit timeline", () => {
  it("matches one operation per audit payment despite different timestamps and retains other payments", () => {
    const audit = event({
      kind: "money.received",
      moneyKind: "issue_payment",
      amount: 1800,
    });
    expect(unmatchedMoneyOperations([audit], [payment])).toEqual([]);
    expect(
      unmatchedMoneyOperations([audit], [payment, { ...payment, id: 2 }]),
    ).toHaveLength(1);
    expect(
      unmatchedMoneyOperations(
        [audit],
        [{ ...payment, createdAt: "2026-10-25T07:00:00.025Z" }],
      ),
    ).toEqual([]);
    const olderPayment = {
      ...payment,
      id: 2,
      createdAt: "2026-10-24T07:00:00.000Z",
    };
    expect(unmatchedMoneyOperations([audit], [olderPayment, payment])).toEqual([
      olderPayment,
    ]);
    expect(
      unmatchedMoneyOperations([audit], [{ ...payment, legacyImported: true }]),
    ).toHaveLength(1);
    expect(
      unmatchedMoneyOperations(
        [audit],
        [{ ...payment, kind: "customer_refund" }],
      ),
    ).toHaveLength(1);
  });
  it("does not invent a prepayment timestamp or count an initial deposit twice", () => {
    const created = event({
      kind: "visit.created",
      visitCode: "1234",
      clientId: 1,
      clientName: "Алия",
      startDateTime: "2026-10-25",
      endDateTime: "2026-10-26",
      orders: [
        {
          orderId: 1,
          childName: "Маша",
          costumeName: "Эльза",
          inventoryCode: "C-0001",
          rentPrice: 3800,
          prepaymentAmount: 2000,
        },
      ],
    });
    expect(unknownPrepayment([created], 2000)).toBe(0);
    expect(unknownPrepayment([], 2000)).toBe(2000);
    const updated = event({
      kind: "visit.updated",
      changedFields: {},
      orderChanges: [
        {
          change: "added",
          orderId: 2,
          after: {
            orderId: 2,
            childName: "Маша",
            costumeName: "Фея",
            inventoryCode: "C-0002",
            rentPrice: 4000,
            prepaymentAmount: 1500,
          },
        },
      ],
    });
    expect(unknownPrepayment([created, updated], 3500)).toBe(0);
  });
});
