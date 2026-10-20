import { TypedStatusError } from "@costumes/shared";
import { ZodError } from "zod";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { apiClient, resolveApiBaseUrl } from "./apiClient";
import { useAuthStore } from "src/stores/auth.store";
import { API_URL, server } from "../../test/server";

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, isAuth: false, user: null });
});
describe("typed API client", () => {
  it("resolves relative production and development base URLs once", () => {
    expect(resolveApiBaseUrl("/api", "https://crm.example")).toBe(
      "https://crm.example/api",
    );
    expect(resolveApiBaseUrl("http://localhost:5000/api", "http://localhost:5173")).toBe(
      "http://localhost:5000/api",
    );
  });

  it("validates requests before sending them", async () => {
    let called = false;
    server.use(
      http.post(`${API_URL}/clients`, () => {
        called = true;
        return HttpResponse.json({ clientId: 1, name: "Alia", phone: "+77001112233", isBlacklisted: false }, { status: 201 });
      }),
    );

    await expect(apiClient.post("/clients", { body: { name: "A", phone: "bad" } })).rejects.toBeInstanceOf(ZodError);
    expect(called).toBe(false);
  });

  it("validates responses while retaining unknown fields", async () => {
    server.use(
      http.get(`${API_URL}/clients/search`, () =>
        HttpResponse.json([{ clientId: 1, name: "Alia", phone: "+77001112233", isBlacklisted: false, futureField: "kept" }]),
      ),
    );
    const result = await apiClient.get("/clients/search", { query: { q: "Al" } });
    expect(result[0]).toMatchObject({ clientId: 1, futureField: "kept" });

    server.use(http.get(`${API_URL}/clients/search`, () => HttpResponse.json([{ clientId: "bad" }])));
    await expect(apiClient.get("/clients/search", { query: { q: "Al" } })).rejects.toBeInstanceOf(ZodError);
  });

  it("accepts the date and status shape returned by costume availability", async () => {
    let receivedDates: string[] = [];
    server.use(
      http.get(`${API_URL}/costumes/search-available`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        receivedDates = [query.get("startDate") ?? "", query.get("endDate") ?? ""];
        return HttpResponse.json([
          { costumeId: 5, name: "Эльза", inventoryCode: "C-0128", status: "available" },
          { costumeId: 6, name: "Анна", inventoryCode: "C-0129", status: "issued" },
        ]);
      }),
    );
    await expect(apiClient.get("/costumes/search-available", {
      query: { q: "Эльза", startDate: "2026-12-20T18:30", endDate: "2026-12-21T18:00" },
    })).resolves.toHaveLength(2);
    expect(receivedDates).toEqual(["2026-12-20T18:30", "2026-12-21T18:00"]);
  });

  it("accepts 204 responses and exposes HTTP errors with parsed response data", async () => {
    server.use(
      http.delete(`${API_URL}/clients/1`, () => new HttpResponse(null, { status: 204 })),
      http.get(`${API_URL}/clients/search`, () => HttpResponse.json({ statusCode: 401, message: "Требуется вход" }, { status: 401 })),
      http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json({ accessToken: "fresh" })),
    );
    await expect(apiClient.delete("/clients/{clientId}", { path: { clientId: 1 } })).resolves.toBeUndefined();
    const responseError = apiClient.get("/clients/search", { query: { q: "Al" } });
    await expect(responseError).rejects.toMatchObject({
      status: 401,
      response: { data: { statusCode: 401, message: "Требуется вход" } },
    });
    await expect(responseError).rejects.toBeInstanceOf(TypedStatusError);
  });

  it("refreshes and retries writes with the same idempotency key", async () => {
    useAuthStore.setState({ accessToken: "stale", isAuth: true, user: null });
    const keys: Array<string | null> = [];
    server.use(
      http.post(`${API_URL}/visits`, ({ request }) => {
        keys.push(request.headers.get("x-idempotency-key"));
        if (request.headers.get("authorization") !== "Bearer fresh") {
          return HttpResponse.json({ statusCode: 401, message: "expired" }, { status: 401 });
        }
        return HttpResponse.json({
          id: 1, visitCode: "0001", status: "reserved",
          client: { id: 1, fullname: "Alia", phone: "+77001112233" },
          visitDate: { startDateTime: "2026-01-01", endDateTime: "2026-01-02", issueTimeFrom: "10:00", issueTimeTo: "10:30", returnTimeUntil: "18:00" },
          notifications: [], orders: [],
        }, { status: 201 });
      }),
      http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json({ accessToken: "fresh" })),
    );

    const created = await apiClient.post("/visits", {
      body: {
        clientId: 1, visitCode: "0001", startDateTime: "2026-01-01", endDateTime: "2026-01-02",
        issueTimeFrom: "10:00", issueTimeTo: "10:30", returnTimeUntil: "18:00", orders: [],
      },
      query: { sendNotification: false },
    });
    expect(created).toMatchObject({ id: 1, status: "reserved" });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});
