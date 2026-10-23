import { describe, expect, it } from "vitest";
import type { VisitReadDetailDto } from "@costumes/shared";
import { calculateAddIssuedBalance } from "./addIssuedBalance";

const visit: VisitReadDetailDto = {
  id: 12,
  visitCode: "1234",
  status: "issued",
  version: 4,
  client: { id: 2, name: "Алия", phone: "+77071234567" },
  startDateTime: "2026-12-10",
  endDateTime: "2026-12-11",
  issueTimeFrom: "09:00",
  issueTimeTo: "09:00",
  returnTimeUntil: "18:00",
  createdAt: "2026-12-10T08:00:00.000Z",
  orders: [],
  moneyOperations: [],
  deposits: [],
  totals: { totalRent: 10000, totalPrepayment: 0, totalRemaining: 10000 },
  balance: {
    totalRent: 10000,
    totalPrepayment: 0,
    totalReceived: 4000,
    totalRefunded: 0,
    signedBalance: 6000,
    debt: 6000,
    refundDue: 0,
  },
};

describe("calculateAddIssuedBalance", () => {
  it("adds new rent to an existing debt before subtracting the actual payment", () => {
    const preview = calculateAddIssuedBalance(
      visit,
      [{ rentPrice: 8000 }],
      3000,
    );

    expect(preview.currentSignedBalance).toBe(6000);
    expect(preview.totalRentAfter).toBe(18000);
    expect(preview.totalReceivedAfter).toBe(7000);
    expect(preview.debtAfter).toBe(11000);
    expect(preview.refundDueAfter).toBe(0);
  });

  it("uses current overpayment when previewing an additional order", () => {
    const creditVisit: VisitReadDetailDto = {
      ...visit,
      balance: {
        ...visit.balance!,
        signedBalance: -5000,
        totalReceived: 15000,
        debt: 0,
        refundDue: 5000,
      },
    };

    const preview = calculateAddIssuedBalance(
      creditVisit,
      [{ rentPrice: 3000 }],
      0,
    );

    expect(preview.signedBalanceAfter).toBe(-2000);
    expect(preview.debtAfter).toBe(0);
    expect(preview.refundDueAfter).toBe(2000);
  });

  it.each([
    { receivedNow: 0, debtAfter: 14000, refundDueAfter: 0 },
    { receivedNow: 5000, debtAfter: 9000, refundDueAfter: 0 },
    { receivedNow: 20000, debtAfter: 0, refundDueAfter: 6000 },
  ])("previews received-now=$receivedNow including overpayment", ({ receivedNow, debtAfter, refundDueAfter }) => {
    const preview = calculateAddIssuedBalance(
      visit,
      [{ rentPrice: 8000 }],
      receivedNow,
    );

    expect(preview.debtAfter).toBe(debtAfter);
    expect(preview.refundDueAfter).toBe(refundDueAfter);
  });

  it("derives the existing balance from non-voided operations when balance is absent", () => {
    const withoutBalance: VisitReadDetailDto = {
      ...visit,
      balance: undefined,
      moneyOperations: [
        { id: 1, kind: "issue_payment", amount: 7000, createdAt: "2026-12-10T10:00:00.000Z", legacyImported: false },
        { id: 2, kind: "customer_refund", amount: 2000, createdAt: "2026-12-10T11:00:00.000Z", legacyImported: false },
        { id: 3, kind: "debt_payment", amount: 10000, createdAt: "2026-12-10T12:00:00.000Z", voidedAt: "2026-12-10T13:00:00.000Z", legacyImported: false },
      ],
    };

    const preview = calculateAddIssuedBalance(withoutBalance, [{ rentPrice: 1000 }], 0);

    expect(preview.currentSignedBalance).toBe(5000);
    expect(preview.totalReceivedAfter).toBe(7000);
    expect(preview.totalRefundedAfter).toBe(2000);
    expect(preview.debtAfter).toBe(6000);
  });
});
