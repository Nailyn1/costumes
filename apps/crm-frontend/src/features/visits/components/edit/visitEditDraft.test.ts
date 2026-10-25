import type { VisitReadDetailDto } from "@costumes/shared";
import { describe, expect, it } from "vitest";
import {
  canRemoveVisitEditOrder,
  createUpdateReservedVisitRequest,
  createVisitEditDraftFromRequest,
  createEmptyVisitEditOrder,
  createVisitEditDraft,
  isVisitEditPriceValid,
  type VisitEditOrderDraft,
} from "./visitEditDraft";

type EditSource = Parameters<typeof createVisitEditDraft>[0];
type ReadOrder = VisitReadDetailDto["orders"][number];

function source(overrides: Partial<EditSource> = {}): EditSource {
  const orders: ReadOrder[] = [
    {
      orderId: 11,
      childId: 21,
      childName: "Алия",
      costumeId: 31,
      costumeName: "Фея",
      inventoryCode: "C-0031",
      status: "reserved",
      tagStatus: "written",
      rentPrice: 7000,
      prepaymentAmount: 2000,
      notes: "Позвонить перед выдачей",
    },
  ];

  return {
    startDateTime: "2026-12-10",
    endDateTime: "2026-12-11",
    issueTimeFrom: "10:00",
    issueTimeTo: "12:00",
    returnTimeUntil: "18:00",
    notes: "Общие пожелания",
    orders,
    ...overrides,
  };
}

describe("visit edit draft", () => {
  it("copies order identities and preserves paid amounts while normalizing optional notes", () => {
    const draft = createVisitEditDraft(
      source({
        notes: undefined,
        orders: [
          {
            ...source().orders[0],
            notes: undefined,
          },
        ],
      }),
    );

    expect(draft).toEqual({
      startDateTime: "2026-12-10",
      endDateTime: "2026-12-11",
      issueTimeFrom: "10:00",
      issueTimeTo: "12:00",
      returnTimeUntil: "18:00",
      notes: "",
      orders: [
        {
          orderId: 11,
          childId: 21,
          costumeId: 31,
          rentPrice: 7000,
          prepaymentAmount: 2000,
          finalPayment: undefined,
          notes: "",
        },
      ],
    });
  });

  it("allows removing only unpaid orders when at least one order remains", () => {
    expect(
      canRemoveVisitEditOrder({ orderId: null, prepaymentAmount: 500 }, 2),
    ).toBe(true);
    expect(canRemoveVisitEditOrder({ prepaymentAmount: 0 }, 2)).toBe(true);
    expect(canRemoveVisitEditOrder({ prepaymentAmount: 1 }, 2)).toBe(false);
    expect(canRemoveVisitEditOrder({ prepaymentAmount: 0 }, 1)).toBe(false);
    const zeroPrepaymentWithPriorPayment: VisitEditOrderDraft = {
      ...createEmptyVisitEditOrder(),
      prepaymentAmount: 0,
      finalPayment: 1,
    };
    expect(canRemoveVisitEditOrder(zeroPrepaymentWithPriorPayment, 2)).toBe(
      true,
    );
  });

  it("creates an unpaid new-order draft without assigning a fake API order id", () => {
    expect(createEmptyVisitEditOrder()).toEqual({
      orderId: null,
      childId: null,
      costumeId: null,
      rentPrice: "",
      prepaymentAmount: 0,
      finalPayment: undefined,
      notes: "",
    });
  });

  it("does not allow rent below the preserved prepayment", () => {
    expect(
      isVisitEditPriceValid({ rentPrice: 2000, prepaymentAmount: 2000 }),
    ).toBe(true);
    expect(
      isVisitEditPriceValid({ rentPrice: 1999, prepaymentAmount: 2000 }),
    ).toBe(false);
    expect(isVisitEditPriceValid({ rentPrice: "", prepaymentAmount: 0 })).toBe(
      false,
    );
  });

  it("sends and restores initial prepayment for a new order without making old prepayment editable", () => {
    const draft = createVisitEditDraft(source());
    draft.orders.push({
      ...createEmptyVisitEditOrder(),
      childId: 21,
      costumeId: 32,
      rentPrice: 4000,
      prepaymentAmount: 1500,
    });
    const request = createUpdateReservedVisitRequest(
      draft,
      7,
      "a06d6c16-7f80-4507-b601-e03c2c13a54b",
    );
    expect(request.orders[0]).not.toHaveProperty("prepaymentAmount");
    expect(request.orders[1].prepaymentAmount).toBe(1500);
    expect(
      createVisitEditDraftFromRequest(source(), request).orders[1]
        .prepaymentAmount,
    ).toBe(1500);
  });

  it("converts detail timestamps to plain dates and builds the shared command body", () => {
    const draft = createVisitEditDraft(
      source({
        startDateTime: "2026-12-10T18:30:00.000Z",
        endDateTime: "2026-12-11T18:00:00.000Z",
      }),
    );
    expect(draft.startDateTime).toBe("2026-12-10");
    expect(draft.endDateTime).toBe("2026-12-11");
    expect(
      createUpdateReservedVisitRequest(
        draft,
        7,
        "a06d6c16-7f80-4507-b601-e03c2c13a54b",
      ),
    ).toEqual({
      commandId: "a06d6c16-7f80-4507-b601-e03c2c13a54b",
      expectedVersion: 7,
      startDateTime: "2026-12-10",
      issueTimeFrom: "10:00",
      issueTimeTo: "12:00",
      endDateTime: "2026-12-11",
      returnTimeUntil: "18:00",
      notes: "Общие пожелания",
      orders: [
        {
          orderId: 11,
          childId: 21,
          costumeId: 31,
          rentPrice: 7000,
          notes: "Позвонить перед выдачей",
        },
      ],
    });
  });
});
