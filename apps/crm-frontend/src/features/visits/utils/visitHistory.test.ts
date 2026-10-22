import type { VisitHistoryEventDto } from "@costumes/shared";
import { describe, expect, it } from "vitest";
import {
  formatVisitHistoryInstant,
  formatVisitHistoryRentalPeriod,
  groupVisitHistoryEvents,
  presentVisitHistoryGroup,
} from "./visitHistory";

function makeEvent(
  overrides: Partial<VisitHistoryEventDto> & Pick<VisitHistoryEventDto, "id" | "action" | "payload" | "commandId" | "occurredAt">,
): VisitHistoryEventDto {
  return {
    actorNameSnapshot: "Алия",
    source: "user",
    entityType: "visit",
    entityId: 12,
    visitId: 12,
    schemaVersion: 1,
    ...overrides,
  };
}

describe("visit history formatters", () => {
  it("formats event instants in the shop timezone", () => {
    expect(formatVisitHistoryInstant("2026-10-22T06:15:00.000Z")).toContain("11:15");
    expect(formatVisitHistoryInstant("2026-10-22T06:15:00.000Z")).toContain("22.10.2026");
  });

  it("formats rental dates as date-only values without timezone conversion", () => {
    expect(formatVisitHistoryRentalPeriod("2026-12-31", "2027-01-01")).toBe(
      "31.12.2026 – 01.01.2027",
    );
  });
});

describe("visit history grouping", () => {
  it("groups events by commandId and orders them by occurredAt then id", () => {
    const later = makeEvent({
      id: 4,
      action: "money.received",
      commandId: "issue-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: { kind: "money.received", moneyKind: "issue_payment", amount: 2000 },
    });
    const earlier = makeEvent({
      id: 2,
      action: "visit.issued",
      commandId: "issue-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: {
        kind: "visit.issued",
        visitCode: "0012",
        additionalPayment: 2000,
        depositType: "cash",
        depositAmount: 5000,
        orders: [],
      },
    });
    const other = makeEvent({
      id: 1,
      action: "visit.created",
      commandId: "create-1",
      occurredAt: "2026-10-21T08:00:00.000Z",
      payload: {
        kind: "visit.created",
        visitCode: "0012",
        clientId: 3,
        clientName: "Алия",
        startDateTime: "2026-10-23",
        endDateTime: "2026-10-25",
        orders: [],
      },
    });

    const groups = groupVisitHistoryEvents([later, earlier, other]);

    expect(groups.map((group) => group.commandId)).toEqual(["create-1", "issue-1"]);
    expect(groups[1]?.events.map((event) => event.id)).toEqual([2, 4]);
  });

  it("shows the issue payment once when receipt and issue share a command", () => {
    const issued = makeEvent({
      id: 8,
      action: "visit.issued",
      commandId: "issue-2",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: {
        kind: "visit.issued",
        visitCode: "0065",
        additionalPayment: 2500,
        depositType: "document",
        depositAmount: 0,
        orders: [],
      },
    });
    const payment = makeEvent({
      id: 9,
      action: "money.received",
      commandId: "issue-2",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: { kind: "money.received", moneyKind: "issue_payment", amount: 2500 },
    });

    const presentation = presentVisitHistoryGroup(
      groupVisitHistoryEvents([issued, payment])[0]!,
    );

    expect(presentation.title).toContain("#0065");
    expect(presentation.details.filter((detail) => detail.includes("2 500"))).toHaveLength(1);
    expect(presentation.details).toContain("Залог: документ");
  });

  it("uses the saved actor snapshot and renders cancellation reason", () => {
    const event = makeEvent({
      id: 10,
      action: "visit.cancelled",
      commandId: "cancel-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: { kind: "visit.cancelled", visitCode: "0065", reason: "Планы изменились" },
    });

    const presentation = presentVisitHistoryGroup(groupVisitHistoryEvents([event])[0]!);

    expect(presentation.actor).toBe("Алия");
    expect(presentation.title).toContain("отменён");
    expect(presentation.details).toContain("Причина: Планы изменились");
  });

  it("keeps settlement and returned-deposit facts in a completed command group", () => {
    const completed = makeEvent({
      id: 11,
      action: "visit.completed",
      commandId: "complete-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: {
        kind: "visit.completed",
        visitCode: "0065",
        orders: [],
        settlementKind: "debt_payment",
        settlementAmount: 1500,
      },
    });
    const payment = makeEvent({
      id: 12,
      action: "money.received",
      commandId: "complete-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: { kind: "money.received", moneyKind: "debt_payment", amount: 1500 },
    });
    const deposit = makeEvent({
      id: 13,
      action: "deposit.returned",
      commandId: "complete-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: { kind: "deposit.returned", depositType: "cash", amount: 5000 },
    });

    const presentation = presentVisitHistoryGroup(
      groupVisitHistoryEvents([completed, payment, deposit])[0]!,
    );

    expect(presentation.details).toContain("Принята оплата долга: 1 500 ₸");
    expect(presentation.details).toContain("Залог возвращён: 5 000 ₸");
    expect(presentation.details.filter((detail) => detail.includes("1 500"))).toHaveLength(1);
  });

  it("does not claim that an absent deposit was returned", () => {
    const event = makeEvent({
      id: 14,
      action: "deposit.returned",
      commandId: "deposit-none",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: { kind: "deposit.returned", depositType: "none", amount: 0 },
    });

    const presentation = presentVisitHistoryGroup(groupVisitHistoryEvents([event])[0]!);

    expect(presentation.title).toBe("Изменение визита");
    expect(presentation.details.join(" ")).not.toContain("Залог возвращён");
  });
});
