import { describe, expect, it } from "vitest";
import { issueBalance } from "./visitBalance";

describe("issueBalance", () => {
  it.each([
    [0, 8000, 8000, 0],
    [3000, 8000, 5000, 0],
    [8000, 8000, 0, 0],
    [10000, 8000, 0, 2000],
  ])("shows balance after %i ₸ paid on %i ₸ remaining", (payment, remaining, debt, refundDue) => {
    expect(issueBalance(remaining, payment)).toEqual({ debt, refundDue });
  });
});
