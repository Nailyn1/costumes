import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuickIssueVisitRequestDto } from "@costumes/shared";
import {
  clearPendingQuickIssueRequest,
  getPendingQuickIssueRequest,
  savePendingQuickIssueRequest,
} from "./quickIssueRequestStorage";

const request: QuickIssueVisitRequestDto = {
  commandId: "a06d6c16-7f80-4507-b601-e03c2c13a54b",
  clientId: 7,
  visitCode: "1648",
  startDateTime: "2026-12-10",
  issueTimeFrom: "09:00",
  issueTimeTo: "09:00",
  endDateTime: "2026-12-11",
  returnTimeUntil: "18:00",
  orders: [{ childId: 10, costumeId: 5, rentPrice: 8000 }],
  additionalPayment: 9000,
  deposit: { type: "none" },
};

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("quick issue request session storage", () => {
  it("restores the same frozen request for the same user after a page reload", () => {
    expect(savePendingQuickIssueRequest("operator-a", request)).toBe(true);

    expect(getPendingQuickIssueRequest("operator-a")).toEqual(request);
  });

  it("does not expose a pending request to a different user or a logged-out session", () => {
    expect(savePendingQuickIssueRequest("operator-a", request)).toBe(true);

    expect(getPendingQuickIssueRequest("operator-b")).toBeNull();
    expect(getPendingQuickIssueRequest(null)).toBeNull();
  });

  it("ignores and removes corrupt persisted JSON", () => {
    window.sessionStorage.setItem(
      "costumes.quick-issue.pending.v1.operator-a",
      "not-json",
    );

    expect(getPendingQuickIssueRequest("operator-a")).toBeNull();
    expect(window.sessionStorage.getItem("costumes.quick-issue.pending.v1.operator-a")).toBeNull();
  });

  it("reports storage failures so the caller can block submitting an unpersisted command", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("storage denied", "QuotaExceededError");
    });

    expect(savePendingQuickIssueRequest("operator-a", request)).toBe(false);
  });

  it("clears only the current user's resolved command", () => {
    savePendingQuickIssueRequest("operator-a", request);
    savePendingQuickIssueRequest("operator-b", { ...request, commandId: "b06d6c16-7f80-4507-b601-e03c2c13a54b" });

    clearPendingQuickIssueRequest("operator-a");

    expect(getPendingQuickIssueRequest("operator-a")).toBeNull();
    expect(getPendingQuickIssueRequest("operator-b")?.commandId).toBe("b06d6c16-7f80-4507-b601-e03c2c13a54b");
  });
});
