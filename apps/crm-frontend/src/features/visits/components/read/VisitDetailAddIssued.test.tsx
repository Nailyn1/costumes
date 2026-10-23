import type { AddAndIssueVisitRequestDto, PaginatedVisitHistoryResponseDto, VisitReadDetailDto } from "@costumes/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { Navigate, Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../../../../test/render";
import { API_URL, server } from "../../../../../test/server";
import { VisitDetailPage } from "../../../../pages/VisitDetailPage";
import { useAuthStore } from "src/stores/auth.store";
import { savePendingAddIssuedRequest } from "../../utils/addIssuedRequestStorage";

const visit: VisitReadDetailDto = {
  id: 12,
  visitCode: "1234",
  status: "issued",
  version: 4,
  client: { id: 2, name: "Алия", phone: "+77071234567" },
  startDateTime: "2026-12-10",
  endDateTime: "2026-12-11",
  issueTimeFrom: "09:00",
  issueTimeTo: "09:30",
  returnTimeUntil: "18:00",
  createdAt: "2026-12-10T08:00:00.000Z",
  orders: [{
    orderId: 1,
    childId: 10,
    childName: "Маша",
    costumeId: 20,
    costumeName: "Эльза",
    inventoryCode: "C-0020",
    status: "issued",
    tagStatus: "written",
    rentPrice: 10000,
    prepaymentAmount: 0,
  }],
  moneyOperations: [{
    id: 5,
    kind: "issue_payment",
    amount: 4000,
    createdAt: "2026-12-10T09:00:00.000Z",
    legacyImported: false,
  }],
  deposits: [{ id: 3, type: "document", returned: false, createdAt: "2026-12-10T08:00:00.000Z" }],
  totals: { totalRent: 10000, totalPrepayment: 0, totalRemaining: 10000 },
  balance: {
    totalRent: 10000,
    totalPrepayment: 0,
    totalReceived: 4000,
    totalRefunded: 0,
    signedBalance: 6000,
    debt: 6000,
    refundDue: 0,
  },
};

const pendingRequest: AddAndIssueVisitRequestDto = {
  commandId: "a06d6c16-7f80-4507-b601-e03c2c13a54b",
  expectedVersion: 4,
  orders: [{ childId: 11, costumeId: 21, rentPrice: 8000, notes: "Синяя лента" }],
  additionalPayment: 3000,
};

const emptyHistory: PaginatedVisitHistoryResponseDto = {
  items: [], total: 0, page: 1, limit: 20, hasMore: false,
};

afterEach(() => {
  window.sessionStorage.clear();
  useAuthStore.setState({ user: null, accessToken: null, isAuth: false });
});

describe("VisitDetailPage add-issued retry recovery", () => {
  it("preserves the frozen form when an ambiguous retry later returns a definitive 4xx", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "test-token",
      user: { login: "operator-a", name: "Алия" },
    });
    savePendingAddIssuedRequest("operator-a", 12, pendingRequest);
    const submittedBodies: unknown[] = [];
    let attempts = 0;

    server.use(
      http.get(`${API_URL}/visits/12`, () => HttpResponse.json({ ...visit, version: 5 })),
      http.get(`${API_URL}/visits/12/history`, () => HttpResponse.json(emptyHistory)),
      http.post(`${API_URL}/visits/12/add-and-issue`, async ({ request }) => {
        submittedBodies.push(await request.json());
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ message: "Временная ошибка" }, { status: 500 })
          : HttpResponse.json({ message: "Некорректная команда" }, { status: 400 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/" element={<Navigate to="/bookings/visits/12" replace />} />
        <Route path="/bookings/visits/:visitId" element={<VisitDetailPage />} />
      </Routes>,
    );

    expect(await screen.findByText("Результат выдачи пока неизвестен")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Повторить выдачу" }));
    await waitFor(() => expect(attempts).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Повторить выдачу" })).toBeEnabled());

    await user.click(screen.getByRole("button", { name: "Повторить выдачу" }));
    await waitFor(() => expect(attempts).toBe(2));

    expect(submittedBodies).toEqual([pendingRequest, pendingRequest]);
    expect(await screen.findByText(/Не удалось добавить костюм/)).toBeInTheDocument();
    expect(screen.getByLabelText("Аренда")).toHaveValue("8 000 ₸");
    expect(screen.getByLabelText("Получено сейчас")).toHaveValue("3 000 ₸");
    expect(screen.getByLabelText("Заметка")).toHaveValue("Синяя лента");
    expect(screen.getByRole("button", { name: "Проверить суммы" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Проверить суммы" }));
    expect(await screen.findByText("Версия визита: 4")).toBeInTheDocument();
  });
});
