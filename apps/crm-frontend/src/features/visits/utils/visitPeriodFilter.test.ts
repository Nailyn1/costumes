import { describe, expect, it } from "vitest";
import { visitPeriodLabel, visitPeriodRange } from "./visitPeriodFilter";

describe("visit issue-date period filter", () => {
  it("starts without date restrictions and uses the local calendar day", () => {
    expect(visitPeriodRange("all", new Date(2026, 9, 25))).toEqual({
      preset: "all",
      from: "",
      to: "",
    });
    expect(visitPeriodRange("today", new Date(2026, 9, 25, 0, 5))).toEqual({
      preset: "today",
      from: "2026-10-25",
      to: "2026-10-25",
    });
  });
  it("handles yesterday across the year boundary and starts the week on Monday", () => {
    expect(visitPeriodRange("yesterday", new Date(2027, 0, 1)).from).toBe(
      "2026-12-31",
    );
    expect(visitPeriodRange("week", new Date(2026, 9, 25))).toEqual({
      preset: "week",
      from: "2026-10-19",
      to: "2026-10-25",
    });
    expect(visitPeriodRange("week", new Date(2026, 9, 19)).from).toBe(
      "2026-10-19",
    );
    expect(
      visitPeriodLabel({
        preset: "custom",
        from: "2026-10-20",
        to: "2026-10-25",
      }),
    ).toBe("20.10.2026 — 25.10.2026");
  });
});
