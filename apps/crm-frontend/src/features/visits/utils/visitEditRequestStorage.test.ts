import type { UpdateReservedVisitRequestDto } from "@costumes/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingVisitEditRequest,
  getPendingVisitEditRequest,
  savePendingVisitEditRequest,
} from "./visitEditRequestStorage";

const request: UpdateReservedVisitRequestDto = {
  commandId: "a06d6c16-7f80-4507-b601-e03c2c13a54b",
  expectedVersion: 4,
  startDateTime: "2026-12-10",
  issueTimeFrom: "10:00",
  issueTimeTo: "12:00",
  endDateTime: "2026-12-11",
  returnTimeUntil: "18:00",
  orders: [{ orderId: 11, childId: 21, costumeId: 31, rentPrice: 7000 }],
};

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("visit edit command storage", () => {
  it("restores the frozen body for the same login and visit", () => {
    expect(savePendingVisitEditRequest("operator-a", 8, request)).toBe(true);
    expect(getPendingVisitEditRequest("operator-a", 8)).toEqual(request);
  });

  it("scopes requests to the current login and visit", () => {
    savePendingVisitEditRequest("operator-a", 8, request);
    expect(getPendingVisitEditRequest("operator-b", 8)).toBeNull();
    expect(getPendingVisitEditRequest("operator-a", 9)).toBeNull();
    expect(getPendingVisitEditRequest(null, 8)).toBeNull();
  });

  it("removes corrupt saved bodies", () => {
    window.sessionStorage.setItem(
      "costumes.visit-edit.pending.v1.operator-a.8",
      "not-json",
    );
    expect(getPendingVisitEditRequest("operator-a", 8)).toBeNull();
    expect(window.sessionStorage.getItem("costumes.visit-edit.pending.v1.operator-a.8")).toBeNull();
  });

  it("reports storage failures so callers can block an unsaved command", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("storage denied", "QuotaExceededError");
    });
    expect(savePendingVisitEditRequest("operator-a", 8, request)).toBe(false);
  });

  it("clears only the matching login and visit command", () => {
    savePendingVisitEditRequest("operator-a", 8, request);
    savePendingVisitEditRequest("operator-a", 9, request);
    clearPendingVisitEditRequest("operator-a", 8);
    expect(getPendingVisitEditRequest("operator-a", 8)).toBeNull();
    expect(getPendingVisitEditRequest("operator-a", 9)).toEqual(request);
  });
});
