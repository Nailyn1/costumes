import * as Sentry from "@sentry/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleError } from "./handleError";

vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));

function axiosError(status: number, data: unknown) {
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, null, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

beforeEach(() => {
  // в DEV handleError пишет в console.error — глушим шум
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("handleError", () => {
  it("returns the Russian message sent by the backend", () => {
    const message = handleError(
      axiosError(400, { message: "Клиент в чёрном списке" }),
      { title: "t" },
    );

    expect(message).toBe("Клиент в чёрном списке");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("falls back to the `error` field and then to the axios message", () => {
    expect(handleError(axiosError(500, { error: "Boom" }), { title: "t" })).toBe(
      "Boom",
    );
    expect(handleError(axiosError(500, {}), { title: "t" })).toBe(
      "Request failed",
    );
  });

  it("stays silent for silentStatuses and does not report to Sentry", () => {
    const message = handleError(axiosError(401, { message: "x" }), {
      title: "t",
      silentStatuses: [401],
    });

    expect(message).toBeNull();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("is not silent for statuses outside silentStatuses", () => {
    const message = handleError(axiosError(404, { message: "Нет" }), {
      title: "t",
      silentStatuses: [401],
    });

    expect(message).toBe("Нет");
  });

  it("returns the message of a plain Error", () => {
    expect(handleError(new Error("упало"), { title: "t" })).toBe("упало");
  });

  it("returns the fallback message for unknown values", () => {
    expect(handleError("str", { title: "t" })).toBe("Непредвиденная ошибка");
    expect(handleError(null, { title: "t", fallbackMessage: "Ой" })).toBe("Ой");
  });
});
