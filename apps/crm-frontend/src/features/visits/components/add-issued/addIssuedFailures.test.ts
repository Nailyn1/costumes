import { describe, expect, it } from "vitest";
import {
  isAmbiguousAddIssuedFailure,
  isStaleVisitVersionConflict,
} from "./addIssuedFailures";

describe("add-issued failure classification", () => {
  it("treats an expected-version conflict as stale and refreshable", () => {
    const error = { response: { status: 409, data: { code: "VISIT_VERSION_CONFLICT" } } };

    expect(isStaleVisitVersionConflict(error)).toBe(true);
    expect(isAmbiguousAddIssuedFailure(error)).toBe(false);
  });

  it.each([409, 401, 408, 429, 500])("keeps an unknown HTTP %s result frozen for retry", (status) => {
    const error = { response: { status, data: { code: "OTHER_CONFLICT" } } };

    expect(isAmbiguousAddIssuedFailure(error)).toBe(true);
  });

  it("treats network failures as ambiguous", () => {
    expect(isAmbiguousAddIssuedFailure(new Error("network unavailable"))).toBe(true);
  });

  it("does not treat a definitive validation failure as ambiguous", () => {
    expect(isAmbiguousAddIssuedFailure({ response: { status: 400, data: {} } })).toBe(false);
  });
});
