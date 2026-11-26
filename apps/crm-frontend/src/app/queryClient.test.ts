import { notifications } from "@mantine/notifications";
import { MutationObserver } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "./queryClient";

vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));

function axiosError(status: number, message: string) {
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, null, {
    status,
    statusText: "",
    data: { statusCode: status, message },
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

async function runMutation(error: Error, meta?: Record<string, unknown>) {
  const observer = new MutationObserver(queryClient, {
    mutationFn: () => Promise.reject(error),
    meta,
  });
  await observer.mutate().catch(() => {});
}

async function runQuery(error: Error, meta?: Record<string, unknown>) {
  await queryClient
    .fetchQuery({
      queryKey: ["q", Math.random()],
      queryFn: () => Promise.reject(error),
      retry: false,
      meta,
    })
    .catch(() => {});
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(notifications, "show").mockImplementation(() => "id");
  queryClient.clear();
});

describe("queryClient global error handling", () => {
  it("shows a red toast with the backend message for a failed query", async () => {
    await runQuery(axiosError(500, "Сервер недоступен"));

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Не удалось загрузить данные", message: "Сервер недоступен", color: "red" }),
    );
  });

  it("does not show a toast for a query with meta.silent", async () => {
    await runQuery(axiosError(500, "Сервер недоступен"), { silent: true });

    expect(notifications.show).not.toHaveBeenCalled();
  });

  it("shows a toast for a failed mutation (e.g. blacklisted client)", async () => {
    await runMutation(axiosError(400, "Клиент в чёрном списке"));

    expect(notifications.show).toHaveBeenCalledTimes(1);
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Не удалось выполнить действие", message: "Клиент в чёрном списке" }),
    );
  });

  it("does not show a toast for a 401 mutation error", async () => {
    await runMutation(axiosError(401, "Unauthorized"));

    expect(notifications.show).not.toHaveBeenCalled();
  });

  it("shows one Russian toast for an invalid login", async () => {
    await runMutation(axiosError(401, "Неверный логин или пароль"), { showUnauthorized: true });

    expect(notifications.show).toHaveBeenCalledTimes(1);
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Не удалось выполнить действие", message: "Неверный логин или пароль", color: "red" }),
    );
  });
});
