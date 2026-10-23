import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API_URL, server } from "../../../../test/server";
import { renderHookWithProviders } from "../../../../test/render";
import { useSearchAvailableCostumes } from "./useCostumes";

describe("useSearchAvailableCostumes", () => {
  it("passes the edited visit id so its own costume is not treated as a conflict", async () => {
    let requestedExcludeVisitId: string | null = null;
    server.use(
      http.get(`${API_URL}/costumes/search-available`, ({ request }) => {
        requestedExcludeVisitId = new URL(request.url).searchParams.get("excludeVisitId");
        return HttpResponse.json([
          { costumeId: 31, name: "Фея", inventoryCode: "C-0031", status: "available" },
        ]);
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useSearchAvailableCostumes("Фея", "2026-12-10T10:00", "2026-12-11T18:00", 12),
    );

    await waitFor(() => expect(result.current.data?.[0]?.costumeId).toBe(31));
    expect(requestedExcludeVisitId).toBe("12");
  });
});
