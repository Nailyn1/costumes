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

  it("groups added issued orders with their payment without counting the receipt twice", () => {
    const added = makeEvent({
      id: 15,
      action: "orders.added_and_issued",
      commandId: "add-issued-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: {
        kind: "orders.added_and_issued",
        visitCode: "0065",
        orders: [{
          orderId: 71,
          childName: "Амина",
          costumeName: "Фея",
          inventoryCode: "C-0071",
          rentPrice: 8000,
          prepaymentAmount: 0,
        }],
      },
    });
    const payment = makeEvent({
      id: 16,
      action: "money.received",
      commandId: "add-issued-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: { kind: "money.received", moneyKind: "issue_payment", amount: 3000 },
    });

    const presentation = presentVisitHistoryGroup(groupVisitHistoryEvents([payment, added])[0]!);

    expect(presentation.title).toBe("Добавлены и выданы костюмы по визиту #0065");
    expect(presentation.details).toContain("Амина — Фея (C-0071)");
    expect(presentation.details.filter((detail) => detail.includes("3 000"))).toHaveLength(1);
    expect(presentation.details).not.toContain("Без залога");
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

  it("renders an edit and its invalidated tag once inside the command group", () => {
    const before = {
      orderId: 31,
      childId: 41,
      childName: "Амина",
      costumeId: 51,
      costumeName: "Принцесса",
      inventoryCode: "C-0051",
      rentPrice: 10000,
      prepaymentAmount: 0,
      notes: "",
    };
    const after = { ...before, rentPrice: 11000 };
    const updated = makeEvent({
      id: 20,
      action: "visit.updated",
      commandId: "edit-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: {
        kind: "visit.updated",
        changedFields: {
          startDateTime: { before: "2026-12-10", after: "2026-12-12" },
          endDateTime: { before: "2026-12-11", after: "2026-12-13" },
          issueTimeFrom: { before: "10:00", after: "11:00" },
        },
        orderChanges: [{ change: "updated", orderId: 31, before, after }],
      },
    });
    const tagReset = makeEvent({
      id: 21,
      action: "tag.invalidated",
      commandId: "edit-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: {
        kind: "tag.invalidated",
        orderId: 31,
        childName: "Амина",
        costumeName: "Принцесса",
        inventoryCode: "C-0051",
        reason: "date_changed",
        previousTagStatus: "written",
        tagStatus: "not_written",
      },
    });

    const group = groupVisitHistoryEvents([tagReset, updated])[0]!;
    const presentation = presentVisitHistoryGroup(group);

    expect(group.events).toHaveLength(2);
    expect(presentation.title).toBe("Визит изменён");
    expect(presentation.details).toContain("Срок аренды: 10.12.2026 – 11.12.2026 → 12.12.2026 – 13.12.2026");
    expect(presentation.details).toContain("Выдача с: 10:00 → 11:00");
    expect(presentation.details).toEqual(expect.arrayContaining([
      expect.stringContaining("аренда:"),
    ]));
    expect(presentation.details.filter((detail) => detail.includes("Бирка сброшена"))).toHaveLength(1);
    expect(presentation.details.join(" ")).not.toContain("Получено");
  });

  it.each([
    ["startDateTime", "Дата выдачи", "endDateTime"],
    ["endDateTime", "Дата возврата", "startDateTime"],
  ] as const)("does not invent an unchanged %s bound in a partial date edit", (field, label, absentField) => {
    const event = makeEvent({
      id: 22,
      action: "visit.updated",
      commandId: `edit-${field}`,
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: {
        kind: "visit.updated",
        changedFields: {
          [field]: field === "startDateTime"
            ? { before: "2026-12-10", after: "2026-12-12" }
            : { before: "2026-12-11", after: "2026-12-13" },
        },
        orderChanges: [],
      },
    });

    const presentation = presentVisitHistoryGroup(groupVisitHistoryEvents([event])[0]!);

    expect(presentation.details).toContain(
      `${label}: ${field === "startDateTime" ? "10.12.2026" : "11.12.2026"} → ${field === "startDateTime" ? "12.12.2026" : "13.12.2026"}`,
    );
    expect(presentation.details.join(" ")).not.toContain(absentField);
    expect(presentation.details.join(" ")).not.toContain("Срок аренды:");
  });
});
