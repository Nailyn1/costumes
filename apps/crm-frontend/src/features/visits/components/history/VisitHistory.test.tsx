import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  PaginatedVisitHistoryResponseDto,
  VisitHistoryEventDto,
} from "@costumes/shared";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API_URL, server } from "../../../../../test/server";
import { renderWithProviders } from "../../../../../test/render";
import { VisitHistory } from "./VisitHistory";

function makeEvent(
  overrides: Partial<VisitHistoryEventDto> &
    Pick<
      VisitHistoryEventDto,
      "id" | "action" | "payload" | "commandId" | "occurredAt"
    >,
): VisitHistoryEventDto {
  return {
    actorNameSnapshot: "Алия",
    source: "user",
    entityType: "visit",
    entityId: 12,
    visitId: 12,
    schemaVersion: 1,
    ...overrides,
  };
}

function page(
  items: VisitHistoryEventDto[],
  overrides: Partial<PaginatedVisitHistoryResponseDto> = {},
): PaginatedVisitHistoryResponseDto {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 20,
    hasMore: false,
    ...overrides,
  };
}

describe("VisitHistory", () => {
  it("shows a legacy-history notice when the event list is empty", async () => {
    server.use(
      http.get(`${API_URL}/visits/12/history`, () =>
        HttpResponse.json(page([])),
      ),
    );

    renderWithProviders(<VisitHistory visitId={12} />);

    expect(
      await screen.findByText(
        "История для старого визита может быть неполной.",
      ),
    ).toBeInTheDocument();
  });

  it("shows grouped issue and payment history with the saved author", async () => {
    const issued = makeEvent({
      id: 1,
      action: "visit.issued",
      commandId: "issue-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: {
        kind: "visit.issued",
        visitCode: "0012",
        additionalPayment: 2000,
        depositType: "cash",
        depositAmount: 5000,
        orders: [
          {
            orderId: 10,
            childName: "Айша",
            costumeName: "Принцесса",
            inventoryCode: "C-0010",
            rentPrice: 7000,
            prepaymentAmount: 5000,
          },
        ],
      },
    });
    const received = makeEvent({
      id: 2,
      action: "money.received",
      commandId: "issue-1",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: {
        kind: "money.received",
        moneyKind: "issue_payment",
        amount: 2000,
      },
    });
    server.use(
      http.get(`${API_URL}/visits/12/history`, () =>
        HttpResponse.json(page([issued, received])),
      ),
    );

    renderWithProviders(<VisitHistory visitId={12} />);

    expect(await screen.findByText("Костюмы выданы")).toBeInTheDocument();
    expect(
      screen.queryByText(/Айша — Принцесса \(C-0010\)/),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Наличный залог: 5\s?000 ₸/)).toBeInTheDocument();
    expect(screen.getByText(/Алия/)).toBeInTheDocument();
    expect(screen.getAllByText(/Получено при выдаче: 2\s?000 ₸/)).toHaveLength(
      1,
    );
  });

  it("loads later pages and merges events sharing a command across pages", async () => {
    const issue = makeEvent({
      id: 3,
      action: "visit.issued",
      commandId: "issue-2",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: {
        kind: "visit.issued",
        visitCode: "0099",
        additionalPayment: 1000,
        depositType: "none",
        depositAmount: 0,
        orders: [],
      },
    });
    const receipt = makeEvent({
      id: 4,
      action: "money.received",
      commandId: "issue-2",
      occurredAt: "2026-10-22T07:00:00.000Z",
      payload: {
        kind: "money.received",
        moneyKind: "issue_payment",
        amount: 1000,
      },
    });
    const requestedPages: string[] = [];
    server.use(
      http.get(`${API_URL}/visits/12/history`, ({ request }) => {
        const url = new URL(request.url);
        const requestedPage = url.searchParams.get("page") ?? "1";
        requestedPages.push(requestedPage);
        return HttpResponse.json(
          requestedPage === "1"
            ? page([issue], { total: 2, hasMore: true })
            : page([receipt], { page: 2, total: 2 }),
        );
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<VisitHistory visitId={12} />);

    expect(await screen.findByText("Костюмы выданы")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Показать более поздние события" }),
    );

    await waitFor(() => expect(requestedPages).toContain("2"));
    await waitFor(() =>
      expect(
        screen.getAllByText(/Получено при выдаче: 1\s?000 ₸/),
      ).toHaveLength(1),
    );
  });

  it("shows a retry action when the history request fails", async () => {
    const handler = vi.fn(() =>
      HttpResponse.json({ message: "Ошибка" }, { status: 500 }),
    );
    server.use(http.get(`${API_URL}/visits/12/history`, handler));

    renderWithProviders(<VisitHistory visitId={12} />);

    expect(
      await screen.findByText("Не удалось загрузить историю визита."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Повторить" }),
    ).toBeInTheDocument();
    expect(handler).toHaveBeenCalled();
  });
});
