import type { GetVisitForIssueDto } from "@costumes/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/render";
import { API_URL, server } from "../../../../../test/server";
import { IssueModal } from "./IssueModal";

const visit: GetVisitForIssueDto = {
  visitId: 12,
  visitCode: "1234",
  client: { name: "Алия", phone: "+77071234567" },
  startDateTime: "2026-12-10",
  endDateTime: "2026-12-11",
  issueTimeFrom: "10:00",
  issueTimeTo: "19:00",
  returnTimeUntil: "18:00",
  totalRentPrice: 5000,
  totalPrepayment: 2800,
  remainingToPay: 2200,
  notes: "",
  orders: [
    {
      orderId: 1,
      childName: "Маша",
      costumeName: "Эльза",
      inventoryCode: "C-0020",
      photoCount: 0,
      tagStatus: "written",
      rentPrice: 5000,
      prepaymentAmount: 2800,
    },
  ],
};

describe("IssueModal shared payment controls", () => {
  it("keeps the existing issue flow with remaining payment, document deposit and tag badge", async () => {
    let submitted: unknown;
    const onClose = vi.fn();
    server.use(
      http.post(`${API_URL}/visits/12/issue`, async ({ request }) => {
        submitted = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <IssueModal
        opened
        onClose={onClose}
        visitId={12}
        isMobile={false}
        data={visit}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText("Бирка есть")).toBeInTheDocument();
    expect(screen.getByLabelText("Сумма доплаты (факт)")).toHaveValue(
      "2 200 ₸",
    );
    expect(screen.getByRole("radio", { name: "Док" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Выдать костюмы" }));
    await waitFor(() =>
      expect(submitted).toMatchObject({
        additionalPayment: 2200,
        deposit: { type: "document" },
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
