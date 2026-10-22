import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Button, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { PaginatedVisitsResponseDto, VisitReadDetailDto } from "@costumes/shared";
import { API_URL, server } from "../../test/server";
import { createTestQueryClient, renderWithProviders } from "../../test/render";
import { VisitsPage } from "./VisitsPage";
import { VisitDetailPage } from "./VisitDetailPage";
import { useMarkCostumeAsWritten } from "src/features/visits/hooks/useVisits";

const emptyHistory = { items: [], total: 0, page: 1, limit: 20, hasMore: false };

function MarkTagTrigger() {
  const mutation = useMarkCostumeAsWritten();
  return <Button onClick={() => mutation.mutate(51)}>Тест: записать бирку</Button>;
}

function visitDetail(overrides: Partial<VisitReadDetailDto> = {}): VisitReadDetailDto {
  return {
    id: 41,
    visitCode: "0041",
    status: "reserved",
    version: 1,
    client: { id: 7, name: "Алия", phone: "+77001234567" },
    startDateTime: "2026-12-20",
    endDateTime: "2026-12-21",
    issueTimeFrom: "10:00",
    issueTimeTo: "12:00",
    returnTimeUntil: "18:00",
    notes: "Позвонить перед выдачей",
    createdAt: "2026-10-22T08:00:00.000Z",
    orders: [
      {
        orderId: 51,
        childId: 8,
        childName: "София",
        costumeId: 9,
        costumeName: "Эльза",
        inventoryCode: "C-0123",
        status: "reserved",
        tagStatus: "written",
        rentPrice: 8000,
        prepaymentAmount: 2000,
      },
    ],
    moneyOperations: [],
    deposits: [],
    totals: { totalRent: 8000, totalPrepayment: 2000, totalRemaining: 6000 },
    ...overrides,
  };
}

function listResponse(page: number, items: PaginatedVisitsResponseDto["items"]): PaginatedVisitsResponseDto {
  return { items, total: 21, page, limit: 20, hasMore: page === 1 };
}

function listItem(id: number): PaginatedVisitsResponseDto["items"][number] {
  return {
    id,
    visitCode: String(id).padStart(4, "0"),
    status: "reserved",
    client: { id: 7, name: "Алия", phone: "+77001234567" },
    startDateTime: "2026-12-20",
    endDateTime: "2026-12-21",
    issueTimeFrom: "10:00",
    issueTimeTo: "12:00",
    returnTimeUntil: "18:00",
    childrenNames: "София",
    costumesNames: "Эльза",
    orderCount: 1,
    totalRent: 8000,
    totalPrepayment: 2000,
    totalRemaining: 6000,
    createdAt: "2026-10-22T08:00:00.000Z",
  };
}

function renderVisits() {
  return renderWithProviders(<VisitsPage />);
}

function renderDetail() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <MemoryRouter initialEntries={["/bookings/visits/41"]}>
          <Routes><Route path="/bookings/visits/:visitId" element={<VisitDetailPage />} /></Routes>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe("visit read pages", () => {
  it("sends debounced search, all date filters, status and server pagination; links to detail", async () => {
    const requestedUrls: URL[] = [];
    server.use(
      http.get(`${API_URL}/visits`, ({ request }) => {
        requestedUrls.push(new URL(request.url));
        const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
        return HttpResponse.json(listResponse(page, page === 1 ? [listItem(41)] : []));
      }),
    );
    const user = userEvent.setup();
    renderVisits();

    expect(await screen.findByText("#0041")).toBeInTheDocument();
    expect(screen.getByText("София")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Карточка" })).toHaveAttribute("href", "/bookings/visits/41");
    await user.type(screen.getByLabelText("Поиск"), "Алия");
    fireEvent.change(screen.getByLabelText("Выдача с"), { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByLabelText("Выдача по"), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByLabelText("Возврат с"), { target: { value: "2026-12-02" } });
    fireEvent.change(screen.getByLabelText("Возврат по"), { target: { value: "2026-12-31" } });
    await user.click(screen.getByRole("combobox", { name: "Статус" }));
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => {
      const request = requestedUrls.find((url) => url.searchParams.get("q") === "Алия" && url.searchParams.get("status") === "reserved");
      expect(request).toBeDefined();
      expect(request?.searchParams.get("status")).toBe("reserved");
      expect(request?.searchParams.get("startDateFrom")).toBe("2026-12-01");
      expect(request?.searchParams.get("startDateTo")).toBe("2026-12-31");
      expect(request?.searchParams.get("endDateFrom")).toBe("2026-12-02");
      expect(request?.searchParams.get("endDateTo")).toBe("2026-12-31");
      expect(request?.searchParams.get("page")).toBe("1");
    });

    await user.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() => expect(requestedUrls.at(-1)?.searchParams.get("page")).toBe("2"));
  });

  it("shows only planned due for reserved visits and omits balance actions without a balance", async () => {
    server.use(
      http.get(`${API_URL}/visits/41`, () => HttpResponse.json(visitDetail())),
      http.get(`${API_URL}/visits/41/history`, () => HttpResponse.json(emptyHistory)),
    );
    renderDetail();

    expect(await screen.findByRole("heading", { name: /Визит #0041/ })).toBeInTheDocument();
    expect(screen.getByText("К доплате при выдаче")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выдать костюмы" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отменить визит" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Записать расчёт" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отметить возврат залога" })).not.toBeInTheDocument();
    expect(screen.getByText("C-0123")).toBeInTheDocument();
    expect(screen.queryByText(/Внутренний ID|версия 1|распределённая итоговая оплата/i)).not.toBeInTheDocument();
  });

  it("does not present the migration timestamp as the receipt date of imported money", async () => {
    const imported = visitDetail({
      status: "completed",
      totals: { totalRent: 8000, totalPrepayment: 2000, totalRemaining: 0 },
      moneyOperations: [{
        id: 4,
        kind: "issue_payment",
        amount: 6000,
        createdAt: "2099-12-31T23:59:00.000Z",
        legacyImported: true,
      }],
    });
    server.use(
      http.get(`${API_URL}/visits/41`, () => HttpResponse.json(imported)),
      http.get(`${API_URL}/visits/41/history`, () => HttpResponse.json(emptyHistory)),
    );
    renderDetail();

    expect(await screen.findByText("Импортировано из прошлых данных; дата операции неизвестна")).toBeInTheDocument();
    expect(screen.queryByText(/2100/)).not.toBeInTheDocument();
  });

  it("refreshes detail and history after an action while preserving the server-updated state", async () => {
    let tagWritten = false;
    const detailRequests = vi.fn(() => HttpResponse.json(visitDetail({
      orders: [{ ...visitDetail().orders[0], tagStatus: tagWritten ? "written" : "not_written" }],
    })));
    const historyRequests = vi.fn(() => HttpResponse.json(emptyHistory));
    server.use(
      http.get(`${API_URL}/visits/41`, detailRequests),
      http.get(`${API_URL}/visits/41/history`, historyRequests),
      http.post(`${API_URL}/visits/51/mark-tag-written`, () => {
        tagWritten = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <Notifications />
          <MemoryRouter initialEntries={["/bookings/visits/41"]}>
            <>
              <Routes><Route path="/bookings/visits/:visitId" element={<VisitDetailPage />} /></Routes>
              <MarkTagTrigger />
            </>
          </MemoryRouter>
        </MantineProvider>
      </QueryClientProvider>,
    );

    expect((await screen.findAllByText("Забронирован")).length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText("Нет бирки")).toBeInTheDocument();
    expect(await screen.findByText("История для старого визита может быть неполной.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Тест: записать бирку" }));
    expect(await screen.findByText("Бирка есть")).toBeInTheDocument();
    await waitFor(() => {
      expect(detailRequests).toHaveBeenCalledTimes(2);
      expect(historyRequests).toHaveBeenCalledTimes(2);
    });
  });
});
