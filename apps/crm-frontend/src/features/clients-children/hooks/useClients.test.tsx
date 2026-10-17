import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API_URL, server } from "../../../../test/server";
import { renderHookWithProviders } from "../../../../test/render";
import {
  clientKeys,
  useAddClientToBlacklist,
  useCreateClient,
  useDeleteClient,
  useRemoveClientFromBlacklist,
  useSearchClients,
  useUpdateClient,
} from "./useClients";

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

describe("client mutation hooks: cache invalidation", () => {
  async function runMutation<TVars>(
    useHook: () => {
      mutateAsync: (vars: TVars) => Promise<unknown>;
    },
    vars: TVars,
  ) {
    const { result, queryClient } = renderHookWithProviders(useHook);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await result.current.mutateAsync(vars);
    return { invalidate, queryClient };
  }

  it("invalidates the lists and the client card after adding to the blacklist", async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/clients/1/blacklist`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 201 });
      }),
    );

    const { invalidate } = await runMutation(useAddClientToBlacklist, {
      clientId: 1,
      data: { blacklistReason: "порвали костюм" },
    });

    expect(body).toEqual({ blacklistReason: "порвали костюм" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: clientKeys.lists() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: clientKeys.detail(1) });
  });

  it("invalidates the lists and the client card after removing from the blacklist", async () => {
    const handler = vi.fn(() => new HttpResponse(null, { status: 200 }));
    server.use(http.delete(`${API_URL}/clients/1/blacklist`, handler));

    const { invalidate } = await runMutation(useRemoveClientFromBlacklist, 1);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: clientKeys.lists() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: clientKeys.detail(1) });
  });

  it("invalidates the lists after creating a client", async () => {
    server.use(
      http.post(`${API_URL}/clients`, () =>
        HttpResponse.json({ ...client, clientId: 2 }),
      ),
    );

    const { invalidate } = await runMutation(useCreateClient, {
      name: "Алия",
      phone: "+77071234567",
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: clientKeys.lists() });
  });

  it("invalidates the lists and the client card after an update", async () => {
    server.use(http.patch(`${API_URL}/clients/1`, () => HttpResponse.json(client)));

    const { invalidate } = await runMutation(useUpdateClient, {
      clientId: 1,
      data: { name: "Алия" },
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: clientKeys.lists() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: clientKeys.detail(1) });
  });

  it("invalidates the lists and drops the cached form state after a delete", async () => {
    server.use(
      http.delete(`${API_URL}/clients/1`, () => new HttpResponse(null, { status: 200 })),
    );
    const { result, queryClient } = renderHookWithProviders(useDeleteClient);
    queryClient.setQueryData(clientKeys.formState("1"), { id: "1" });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await result.current.mutateAsync(1);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: clientKeys.lists() });
    expect(queryClient.getQueryData(clientKeys.formState("1"))).toBeUndefined();
  });
});
