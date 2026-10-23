import type { VisitReadDetailDto } from "@costumes/shared";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { clientKeys } from "src/features/clients-children/hooks/useClients";
import type { SelectedClientData } from "src/features/clients-children/types/clientTypes";
import { renderWithProviders } from "../../../../../test/render";
import { AddIssuedDraftModal } from "./AddIssuedDraftModal";

const visit: VisitReadDetailDto = {
  id: 12,
  visitCode: "1234",
  status: "issued",
  version: 4,
  client: { id: 2, name: "Алия", phone: "+77071234567" },
  startDateTime: "2026-12-10",
  endDateTime: "2026-12-11",
  issueTimeFrom: "09:00",
  issueTimeTo: "09:00",
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
  moneyOperations: [],
  deposits: [{
    id: 3,
    type: "document",
    returned: false,
    createdAt: "2026-12-10T08:00:00.000Z",
  }],
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

describe("AddIssuedDraftModal", () => {
  it("keeps old orders and deposit read-only and inherits the current visit period", () => {
    const onConfirm = vi.fn();
    const { queryClient } = renderWithProviders(
      <AddIssuedDraftModal
        opened
        visitSnapshot={visit}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    queryClient.setQueryData<SelectedClientData>(clientKeys.formState("2"), {
      id: "2",
      name: "Алия",
      phone: "+77071234567",
      children: [{ childId: 10, name: "Маша" }],
      isBlacklisted: false,
      whatsappConfirmed: false,
    });

    expect(screen.getByText("Уже выдано · только для просмотра")).toBeInTheDocument();
    expect(screen.getByText("Клиент: Алия · +77071234567")).toBeInTheDocument();
    expect(screen.getByText("Срок аренды: 10.12.2026 — 11.12.2026")).toBeInTheDocument();
    expect(screen.getByText("Маша — Эльза · аренда 10 000 ₸")).toBeInTheDocument();
    expect(screen.getByText("Существующий залог: Документ · удерживается · без изменений")).toBeInTheDocument();
    expect(screen.getByText("Текущий баланс: Долг: 6 000 ₸")).toBeInTheDocument();
    expect(screen.getByText("Визит после выдачи: аренда 10 000 ₸")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps the opening version and balance while refreshed visit data arrives in the background", () => {
    const { rerender } = renderWithProviders(
      <AddIssuedDraftModal opened visitSnapshot={visit} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    const refreshedVisit: VisitReadDetailDto = {
      ...visit,
      version: 5,
      balance: {
        ...visit.balance!,
        signedBalance: 12000,
        debt: 12000,
      },
    };

    rerender(
      <AddIssuedDraftModal opened visitSnapshot={refreshedVisit} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByText("Текущий баланс: Долг: 6 000 ₸")).toBeInTheDocument();
    expect(screen.queryByText("Текущий баланс: Долг: 12 000 ₸")).not.toBeInTheDocument();
  });

  it("shows stale-version guidance and requires an explicit rebase before review", () => {
    const onRebase = vi.fn();
    renderWithProviders(
      <AddIssuedDraftModal
        opened
        visitSnapshot={visit}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        staleSnapshot={{ currentVersion: 5 }}
        onRebase={onRebase}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Ваша версия 4, текущая версия 5. Черновик сохранён.");
    expect(screen.getByRole("button", { name: "Проверить суммы" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Обновить версию" })).toBeInTheDocument();
  });
});
