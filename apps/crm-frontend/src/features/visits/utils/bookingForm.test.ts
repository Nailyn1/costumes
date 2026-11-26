import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import type { BookingFormValues } from "../types/visitTypes";
import {
  buildCreateVisitPayload,
  clampPrepayment,
  createEmptyOrder,
  nextDayISO,
  parseSmartDate,
} from "./bookingForm";

const now = dayjs("2026-12-10T12:00:00");

describe("parseSmartDate", () => {
  it("expands a bare day to that day of the current month", () => {
    expect(parseSmartDate("11", now)).toBe("2026-12-11");
  });

  it("keeps today when the day is today", () => {
    expect(parseSmartDate("10", now)).toBe("2026-12-10");
  });

  it("moves a day that has already passed to the next month", () => {
    expect(parseSmartDate("5", now)).toBe("2027-01-05");
  });

  it("parses DD.MM within the current year", () => {
    expect(parseSmartDate("15.05", now)).toBe("2026-05-15");
    expect(parseSmartDate("1.2", now)).toBe("2026-02-01");
  });

  it("returns undefined for input it cannot understand", () => {
    expect(parseSmartDate("", now)).toBeUndefined();
    expect(parseSmartDate("abc", now)).toBeUndefined();
    expect(parseSmartDate("45", now)).toBeUndefined();
    expect(parseSmartDate("1.2.3", now)).toBeUndefined();
  });
});

describe("clampPrepayment", () => {
  it("limits prepayment to the new rent when it exceeds it", () => {
    expect(clampPrepayment(3000, 5000)).toBe(3000);
  });

  it("keeps prepayment that does not exceed the rent", () => {
    expect(clampPrepayment(5000, 3000)).toBe(3000);
    expect(clampPrepayment(5000, 5000)).toBe(5000);
    expect(clampPrepayment(5000, undefined)).toBeUndefined();
  });
});

describe("nextDayISO", () => {
  it("returns the following day", () => {
    expect(nextDayISO("2026-12-20")).toBe("2026-12-21");
  });

  it("rolls over month and year boundaries", () => {
    expect(nextDayISO("2026-12-31")).toBe("2027-01-01");
    expect(nextDayISO("2026-02-28")).toBe("2026-03-01");
  });

  it("returns null for an invalid date", () => {
    expect(nextDayISO("не дата")).toBeNull();
  });
});

describe("buildCreateVisitPayload", () => {
  const values: BookingFormValues = {
    clientId: "7",
    visitCode: "1648",
    startDateTime: "2026-12-20",
    endDateTime: "2026-12-21",
    issueTimeFrom: "18:30",
    issueTimeTo: "19:30",
    returnTimeUntil: "18:00",
    notes: "",
    orders: [
      {
        childId: 10,
        costumeId: 5,
        rentPrice: 8000,
        prepaymentAmount: 3000,
        notes: "в пакете",
      },
      { ...createEmptyOrder(), childId: 11, costumeId: 6, rentPrice: 5000 },
    ],
  };

  it("converts string ids to numbers and keeps visit dates and times as is", () => {
    const payload = buildCreateVisitPayload(values);

    expect(payload).toMatchObject({
      clientId: 7,
      visitCode: "1648",
      startDateTime: "2026-12-20",
      endDateTime: "2026-12-21",
      issueTimeFrom: "18:30",
      issueTimeTo: "19:30",
      returnTimeUntil: "18:00",
    });
  });

  it("maps every order and defaults missing money and notes to 0 / empty", () => {
    const { orders } = buildCreateVisitPayload(values);

    expect(orders).toEqual([
      {
        childId: 10,
        costumeId: 5,
        rentPrice: 8000,
        prepaymentAmount: 3000,
        notes: "в пакете",
      },
      {
        childId: 11,
        costumeId: 6,
        rentPrice: 5000,
        prepaymentAmount: 0,
        notes: "",
      },
    ]);
  });
});
