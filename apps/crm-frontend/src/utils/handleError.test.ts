import * as Sentry from "@sentry/react";
import { AxiosError, AxiosHeaders } from "axios";
import { TypedStatusError } from "@costumes/shared";
import { ZodError } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getApiFieldErrors, handleError } from "./handleError";

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

function typedError(status: number, data: unknown) {
  const response = {
    status,
    statusText: "",
    data,
    ok: false,
    headers: new Headers(),
  };
  return new TypedStatusError(response as never);
}

beforeEach(() => {
  // в DEV handleError пишет в console.error — глушим шум
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("handleError", () => {
  it("returns the Russian message sent by the backend", () => {
    const message = handleError(
      axiosError(400, { statusCode: 400, message: "Клиент в чёрном списке" }),
      { title: "t" },
    );

    expect(message).toBe("Клиент в чёрном списке");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("uses the typed API error message and never exposes technical payloads", () => {
    expect(handleError(typedError(409, { statusCode: 409, message: "Костюм занят" }), { title: "t" })).toBe("Костюм занят");
    expect(handleError(axiosError(500, { statusCode: 500, message: "[{invalid_format: /regex/}]" }), { title: "t" })).toBe("Не удалось выполнить действие. Повторите попытку");
    expect(handleError(axiosError(500, { error: "Boom" }), { title: "t" })).toBe("Не удалось выполнить действие. Повторите попытку");
  });

  it("stays silent for silentStatuses and does not report to Sentry", () => {
    const message = handleError(axiosError(401, { statusCode: 401, message: "Не авторизован" }), {
      title: "t",
      silentStatuses: [401],
    });

    expect(message).toBeNull();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("is not silent for statuses outside silentStatuses", () => {
    const message = handleError(axiosError(404, { statusCode: 404, message: "Нет" }), {
      title: "t",
      silentStatuses: [401],
    });

    expect(message).toBe("Нет");
  });

  it("shows a short message for contract violations and keeps details in diagnostics", () => {
    const error = new ZodError([{ code: "invalid_type", expected: "number", path: ["statusCode"], message: "Expected number" }]);
    expect(handleError(error, { title: "t" })).toBe("Ошибка обработки данных. Повторите действие или обратитесь к администратору");
    expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.anything());
  });

  it("shows safe messages for network and unexpected errors", () => {
    expect(handleError(new AxiosError("Network Error", "ERR_NETWORK"), { title: "t" })).toBe("Нет соединения с сервером. Проверьте подключение и повторите действие");
    expect(handleError(new Error("password=secret"), { title: "t" })).toBe("Не удалось выполнить действие. Повторите попытку");
  });

  it("extracts safe field messages from a matching API response", () => {
    const error = typedError(400, {
      statusCode: 400,
      message: "Проверьте поля формы",
      fieldErrors: { phone: ["Неверный номер телефона"], password: ["[{invalid_type}]"], name: "bad" },
    });
    expect(getApiFieldErrors(error)).toEqual({ phone: ["Неверный номер телефона"] });
    expect(getApiFieldErrors(typedError(409, { statusCode: 400, message: "Ошибка", fieldErrors: { phone: ["Неверный номер"] } }))).toBeNull();
  });

  it("returns the fallback message for unknown values", () => {
    expect(handleError("str", { title: "t" })).toBe("Не удалось выполнить действие. Повторите попытку");
    expect(handleError(null, { title: "t", fallbackMessage: "Ой" })).toBe("Ой");
  });
});
