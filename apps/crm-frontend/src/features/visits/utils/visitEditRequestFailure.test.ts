import { describe, expect, it } from "vitest";
import {
  isAmbiguousVisitEditFailure,
  isVisitVersionConflict,
} from "./visitEditRequestFailure";

describe("visit edit request failures", () => {
  it("treats only the version conflict code as a rebaseable known conflict", () => {
    expect(isVisitVersionConflict({ response: { status: 409, data: { code: "VISIT_VERSION_CONFLICT" } } })).toBe(true);
    expect(isAmbiguousVisitEditFailure({ response: { status: 409, data: { code: "VISIT_VERSION_CONFLICT" } } })).toBe(false);
    expect(isAmbiguousVisitEditFailure({ response: { status: 409, data: { code: "OTHER_CONFLICT" } } })).toBe(true);
    expect(isAmbiguousVisitEditFailure({ response: { status: 409, data: {} } })).toBe(true);
  });

  it("retains commands after uncertain transport and server outcomes", () => {
    expect(isAmbiguousVisitEditFailure(new TypeError("network failed"))).toBe(true);
    expect(isAmbiguousVisitEditFailure({ response: { status: 408 } })).toBe(true);
    expect(isAmbiguousVisitEditFailure({ response: { status: 429 } })).toBe(true);
    expect(isAmbiguousVisitEditFailure({ response: { status: 500 } })).toBe(true);
  });

  it("allows a new command after a known validation or not-found response", () => {
    expect(isAmbiguousVisitEditFailure({ response: { status: 400 } })).toBe(false);
    expect(isAmbiguousVisitEditFailure({ response: { status: 404 } })).toBe(false);
  });
});
