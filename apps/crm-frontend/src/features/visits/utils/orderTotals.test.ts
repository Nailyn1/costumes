import { describe, expect, it } from "vitest";
import { calcOrderTotals } from "./orderTotals";

describe("calcOrderTotals", () => {
  it("returns zeros for a form without orders", () => {
    expect(calcOrderTotals([])).toEqual({
      rent: 0,
      prepayment: 0,
      remaining: 0,
    });
  });

  it("treats empty (undefined) fields as 0", () => {
    expect(
      calcOrderTotals([{ rentPrice: undefined, prepaymentAmount: undefined }]),
    ).toEqual({ rent: 0, prepayment: 0, remaining: 0 });
  });

  it("sums rent and prepayment over all orders; remaining = rent - prepayment", () => {
    expect(
      calcOrderTotals([
        { rentPrice: 5000, prepaymentAmount: 1000 },
        { rentPrice: 7000, prepaymentAmount: 7000 },
        { rentPrice: 3000, prepaymentAmount: undefined },
      ]),
    ).toEqual({ rent: 15000, prepayment: 8000, remaining: 7000 });
  });

  it("gives zero remaining when everything is prepaid", () => {
    expect(
      calcOrderTotals([{ rentPrice: 5000, prepaymentAmount: 5000 }]).remaining,
    ).toBe(0);
  });
});
