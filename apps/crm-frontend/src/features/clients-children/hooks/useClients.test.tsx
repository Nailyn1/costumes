import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API_URL, server } from "../../../../test/server";
import { renderHookWithProviders } from "../../../../test/render";
import { useSearchClients } from "./useClients";

const client = {
  clientId: 1,
  name: "Алия",
  phone: "+77071234567",
  children: [],
  isBlacklisted: false,
};

describe("useSearchClients", () => {
  it("does not fetch for queries shorter than 2 characters", () => {
    const handler = vi.fn(() => HttpResponse.json([client]));
    server.use(http.get(`${API_URL}/clients/search`, handler));

    const { result } = renderHookWithProviders(() => useSearchClients(" а "));

    expect(result.current.fetchStatus).toBe("idle");
    expect(handler).not.toHaveBeenCalled();
  });

  it("fetches and returns clients for a valid query", async () => {
    server.use(
      http.get(`${API_URL}/clients/search`, () => HttpResponse.json([client])),
    );

    const { result } = renderHookWithProviders(() => useSearchClients("Али"));

    await waitFor(() => expect(result.current.data).toEqual([client]));
  });
});
