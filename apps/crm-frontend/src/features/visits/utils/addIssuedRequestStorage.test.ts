import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddAndIssueVisitRequestDto } from "@costumes/shared";
import {
  clearPendingAddIssuedRequest,
  getPendingAddIssuedRequest,
  savePendingAddIssuedRequest,
} from "./addIssuedRequestStorage";

const request: AddAndIssueVisitRequestDto = {
  commandId: "a06d6c16-7f80-4507-b601-e03c2c13a54b",
  expectedVersion: 4,
  orders: [
    { childId: 10, costumeId: 20, rentPrice: 8000, notes: "" },
    { childId: 11, costumeId: 21, rentPrice: 6000 },
  ],
  additionalPayment: 3000,
};

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("add-issued request session storage", () => {
  it("restores the exact frozen body for the same login and visit", () => {
    expect(savePendingAddIssuedRequest("operator-a", 12, request)).toBe(true);

    expect(getPendingAddIssuedRequest("operator-a", 12)).toEqual(request);
  });

  it("scopes pending commands to both login and visit", () => {
    savePendingAddIssuedRequest("operator-a", 12, request);

    expect(getPendingAddIssuedRequest("operator-b", 12)).toBeNull();
    expect(getPendingAddIssuedRequest("operator-a", 13)).toBeNull();
    expect(getPendingAddIssuedRequest(null, 12)).toBeNull();
  });

  it("removes corrupt or invalid payloads", () => {
    const key = "costumes.add-issued.pending.v1.operator-a.12";
    window.sessionStorage.setItem(key, "not-json");

    expect(getPendingAddIssuedRequest("operator-a", 12)).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();

    window.sessionStorage.setItem(key, JSON.stringify({ ...request, expectedVersion: 0 }));
    expect(getPendingAddIssuedRequest("operator-a", 12)).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  it("blocks a command if the frozen body cannot be persisted", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("storage denied", "QuotaExceededError");
    });

    expect(savePendingAddIssuedRequest("operator-a", 12, request)).toBe(false);
  });

  it("clears only the resolved login and visit command", () => {
    savePendingAddIssuedRequest("operator-a", 12, request);
    savePendingAddIssuedRequest("operator-a", 13, { ...request, commandId: "b06d6c16-7f80-4507-b601-e03c2c13a54b" });

    clearPendingAddIssuedRequest("operator-a", 12);

    expect(getPendingAddIssuedRequest("operator-a", 12)).toBeNull();
    expect(getPendingAddIssuedRequest("operator-a", 13)?.commandId).toBe("b06d6c16-7f80-4507-b601-e03c2c13a54b");
  });
});
