import { AxiosError } from "axios";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
// apiClient импортируем первым: так же, как в приложении, иначе цикл api → interceptors → auth.service → apiClient
import "src/services/apiClient";
import { api } from "src/services/api";
import { useAuthStore } from "src/stores/auth.store";
import { API_URL, server } from "../../test/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function setToken(token: string | null) {
  useAuthStore.setState({
    accessToken: token,
    isAuth: token !== null,
    user: null,
  });
}

/** Запоминает заголовки каждого запроса к пути. */
function captureHeaders(method: "get" | "post" | "put" | "patch" | "delete") {
  const seen: Headers[] = [];
  server.use(
    http[method](`${API_URL}/echo`, ({ request }) => {
      seen.push(request.headers);
      return HttpResponse.json({ ok: true });
    }),
  );
  return seen;
}

beforeEach(() => setToken(null));

describe("request interceptor", () => {
  it("adds the Bearer token from the auth store", async () => {
    setToken("tok-1");
    const seen = captureHeaders("get");

    await api.get("/echo");

    expect(seen[0].get("authorization")).toBe("Bearer tok-1");
  });

  it("sends no Authorization header without a token", async () => {
    const seen = captureHeaders("get");

    await api.get("/echo");

    expect(seen[0].has("authorization")).toBe(false);
  });

  it.each(["post", "put", "patch"] as const)(
    "adds a UUID X-Idempotency-Key to %s",
    async (method) => {
      const seen = captureHeaders(method);

      await api[method]("/echo", {});

      expect(seen[0].get("x-idempotency-key")).toMatch(UUID);
    },
  );

  it.each(["get", "delete"] as const)(
    "does not add X-Idempotency-Key to %s",
    async (method) => {
      const seen = captureHeaders(method);

      await api[method]("/echo");

      expect(seen[0].has("x-idempotency-key")).toBe(false);
    },
  );

  it("keeps an idempotency key that was set explicitly", async () => {
    const seen = captureHeaders("post");

    await api.post("/echo", {}, { headers: { "X-Idempotency-Key": "my-key" } });

    expect(seen[0].get("x-idempotency-key")).toBe("my-key");
  });

  it("generates a new idempotency key for every request", async () => {
    const seen = captureHeaders("post");

    await api.post("/echo", {});
    await api.post("/echo", {});

    expect(seen[0].get("x-idempotency-key")).not.toBe(
      seen[1].get("x-idempotency-key"),
    );
  });
});

describe("401 response interceptor", () => {
  /** /protected отвечает 401, пока не придёт токен `fresh`. */
  function protectedEndpoint() {
    const tokens: Array<string | null> = [];
    const keys: Array<string | null> = [];
    server.use(
      http.post(`${API_URL}/protected`, ({ request }) => {
        tokens.push(request.headers.get("authorization"));
        keys.push(request.headers.get("x-idempotency-key"));
        if (request.headers.get("authorization") === "Bearer fresh") {
          return HttpResponse.json({ done: true });
        }
        return HttpResponse.json({ message: "expired" }, { status: 401 });
      }),
    );
    return { tokens, keys };
  }

  it("refreshes the token once and retries the original request with it", async () => {
    setToken("stale");
    const { tokens, keys } = protectedEndpoint();
    const refresh = vi.fn(() => HttpResponse.json({ accessToken: "fresh" }));
    server.use(http.post(`${API_URL}/auth/refresh`, refresh));

    const response = await api.post("/protected", { a: 1 });

    expect(response.data).toEqual({ done: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual(["Bearer stale", "Bearer fresh"]);
    expect(useAuthStore.getState().accessToken).toBe("fresh");
    // повтор идёт с тем же ключом идемпотентности, что и исходный запрос
    expect(keys[0]).toBe(keys[1]);
  });

  it("does not loop when the retried request is rejected with 401 again", async () => {
    setToken("stale");
    const protectedHandler = vi.fn(() =>
      HttpResponse.json({ message: "no" }, { status: 401 }),
    );
    server.use(http.get(`${API_URL}/always-401`, protectedHandler));
    const refresh = vi.fn(() => HttpResponse.json({ accessToken: "fresh" }));
    server.use(http.post(`${API_URL}/auth/refresh`, refresh));

    await expect(api.get("/always-401")).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(protectedHandler).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("logs out and rejects when the refresh fails", async () => {
    useAuthStore.setState({ accessToken: "stale", isAuth: true });
    const { tokens } = protectedEndpoint();
    server.use(
      http.post(`${API_URL}/auth/refresh`, () =>
        HttpResponse.json({ message: "bad refresh" }, { status: 401 }),
      ),
    );

    await expect(api.post("/protected", {})).rejects.toBeInstanceOf(AxiosError);

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      isAuth: false,
    });
    expect(tokens).toEqual(["Bearer stale"]);
  });

  it("does not try to refresh on 401 from /auth/ paths", async () => {
    const refresh = vi.fn(() => HttpResponse.json({ accessToken: "fresh" }));
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json({ message: "Неверный пароль" }, { status: 401 }),
      ),
      http.post(`${API_URL}/auth/refresh`, refresh),
    );

    await expect(api.post("/auth/login", {})).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 409, 500])(
    "passes %i through without refreshing",
    async (status) => {
      setToken("tok");
      const refresh = vi.fn(() => HttpResponse.json({ accessToken: "fresh" }));
      server.use(
        http.get(`${API_URL}/boom`, () =>
          HttpResponse.json({ message: "ошибка" }, { status }),
        ),
        http.post(`${API_URL}/auth/refresh`, refresh),
      );

      await expect(api.get("/boom")).rejects.toMatchObject({
        response: { status },
      });

      expect(refresh).not.toHaveBeenCalled();
      expect(useAuthStore.getState().accessToken).toBe("tok");
    },
  );

  // Зафиксировано «как есть»: общего промиса refresh нет, каждый запрос
  // со своим 401 запускает собственное обновление токена.
  it("refreshes separately for every parallel 401 (current behaviour)", async () => {
    setToken("stale");
    server.use(
      http.get(`${API_URL}/a`, ({ request }) =>
        request.headers.get("authorization") === "Bearer fresh"
          ? HttpResponse.json({ ok: "a" })
          : HttpResponse.json({}, { status: 401 }),
      ),
      http.get(`${API_URL}/b`, ({ request }) =>
        request.headers.get("authorization") === "Bearer fresh"
          ? HttpResponse.json({ ok: "b" })
          : HttpResponse.json({}, { status: 401 }),
      ),
    );
    const refresh = vi.fn(() => HttpResponse.json({ accessToken: "fresh" }));
    server.use(http.post(`${API_URL}/auth/refresh`, refresh));

    const [a, b] = await Promise.all([api.get("/a"), api.get("/b")]);

    expect([a.data, b.data]).toEqual([{ ok: "a" }, { ok: "b" }]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
