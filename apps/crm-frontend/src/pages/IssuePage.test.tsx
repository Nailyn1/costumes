import { notifications } from "@mantine/notifications";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { API_URL, server } from "../../test/server";
import { IssuePage } from "./IssuePage";

const SEARCH_TIMEOUT = { timeout: 3000 };

const reservedVisit = {
  visitId: 1,
  visitCode: "1648",
  clientName: "Алия",
  clientPhone: "+77071234567",
  childrenNames: "Маша, Даша",
  costumesNames: "Эльза, Анна",
};

const visitForIssue = {
  visitId: 1,
  visitCode: "1648",
  client: { name: "Алия", phone: "+77071234567" },
  startDateTime: "2026-12-20",
  endDateTime: "2026-12-21",
  issueTimeFrom: "18:30",
  issueTimeTo: "19:30",
  returnTimeUntil: "18:00",
  totalRentPrice: 13000,
  totalPrepayment: 5000,
  remainingToPay: 8000,
  notes: "",
  orders: [
    {
      orderId: 11,
      childName: "Маша",
      costumeName: "Эльза",
      inventoryCode: "C-0128",
      rentPrice: 8000,
      prepaymentAmount: 3000,
      tagStatus: "written",
    },
    {
      orderId: 12,
      childName: "Даша",
      costumeName: "Анна",
      inventoryCode: "C-0129",
      rentPrice: 5000,
      prepaymentAmount: 2000,
      tagStatus: "not_written",
    },
  ],
};

interface IssueRequest {
  visitId: string;
  body: Record<string, unknown>;
}

/** Бэкенд страницы выдачи: список «К выдаче», карточка визита и приём `POST /visits/:id/issue`. */
function mockBackend(
  issue: (req: IssueRequest) => Response | Promise<Response> = () =>
    new HttpResponse(null, { status: 201 }),
) {
  const issued: IssueRequest[] = [];
  const cancelled: Array<Record<string, unknown>> = [];
  const searchQueries: string[] = [];
  const reservedHandler = vi.fn(() =>
    HttpResponse.json({
      items: [reservedVisit],
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false,
    }),
  );
  server.use(
    http.get(`${API_URL}/visits/reserved`, reservedHandler),
    http.get(`${API_URL}/visits/search`, ({ request }) => {
      searchQueries.push(new URL(request.url).searchParams.get("q") ?? "");
      return HttpResponse.json([
        { ...reservedVisit, startDateTime: "2026-12-20" },
      ]);
    }),
    http.get(`${API_URL}/visits/1/for-issue`, () =>
      HttpResponse.json(visitForIssue),
    ),
    http.post(`${API_URL}/visits/:visitId/issue`, async ({ request, params }) => {
      const req = {
        visitId: String(params.visitId),
        body: (await request.json()) as Record<string, unknown>,
      };
      issued.push(req);
      return issue(req);
    }),
    http.post(`${API_URL}/visits/:visitId/cancel`, async ({ request }) => {
      cancelled.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ visitId: 1 });
    }),
  );
  return { issued, cancelled, searchQueries, reservedHandler };
}

async function openVisitModal(user: ReturnType<typeof userEvent.setup>) {
  renderWithProviders(<IssuePage />);
  await user.click(await screen.findByText("#1648"));
  return screen.findByRole("dialog");
}

describe("IssuePage", () => {
  it("lists reserved visits for today and shows a hint when there are none", async () => {
    mockBackend();
    server.use(
      http.get(`${API_URL}/visits/reserved`, () =>
        HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          limit: 20,
          hasMore: false,
        }),
      ),
    );

    renderWithProviders(<IssuePage />);

    expect(
      await screen.findByText("На эти даты заказов нет"),
    ).toBeInTheDocument();
  });

  it("shows the reserved visit row with client, children and costumes", async () => {
    mockBackend();
    renderWithProviders(<IssuePage />);

    expect(await screen.findByText("#1648")).toBeInTheDocument();
    expect(screen.getByText("Алия")).toBeInTheDocument();
    expect(screen.getByText("Маша, Даша")).toBeInTheDocument();
    expect(screen.getByText("Эльза, Анна")).toBeInTheDocument();
  });

  describe("search", () => {
    it("does not query the API for a single character", async () => {
      const { searchQueries } = mockBackend();
      const user = userEvent.setup();
      renderWithProviders(<IssuePage />);
      await screen.findByText("#1648");

      await user.type(screen.getByPlaceholderText(/Выдача: поиск/), "1");
      await new Promise((resolve) => setTimeout(resolve, 600)); // дебаунс 400 мс

      expect(searchQueries).toEqual([]);
    });

    it("sends q for 2+ characters and opens the visit card of the chosen result", async () => {
      const { searchQueries } = mockBackend();
      const user = userEvent.setup();
      renderWithProviders(<IssuePage />);
      await screen.findByText("#1648");

      await user.type(screen.getByPlaceholderText(/Выдача: поиск/), "C-0128");
      // результат поиска — второй «#1648» (первый — строка таблицы)
      await waitFor(
        () => expect(screen.getAllByText("#1648")).toHaveLength(2),
        SEARCH_TIMEOUT,
      );
      expect(searchQueries.at(-1)).toBe("C-0128");

      await user.click(screen.getAllByText("#1648")[1]);

      const dialog = await screen.findByRole("dialog");
      expect(
        await within(dialog).findByText("Выдача заказа #1648"),
      ).toBeInTheDocument();
    });

    it("shows «Ничего не найдено» when nothing matches", async () => {
      mockBackend();
      server.use(
        http.get(`${API_URL}/visits/search`, () => HttpResponse.json([])),
      );
      const user = userEvent.setup();
      renderWithProviders(<IssuePage />);
      await screen.findByText("#1648");

      await user.type(screen.getByPlaceholderText(/Выдача: поиск/), "zzz");

      expect(
        await screen.findByText("Ничего не найдено", undefined, SEARCH_TIMEOUT),
      ).toBeInTheDocument();
    });
  });

  describe("issue modal", () => {
    it("prefills the extra payment with the remaining amount and sends the default deposit", async () => {
      const { issued } = mockBackend();
      const user = userEvent.setup();
      const dialog = await openVisitModal(user);

      // остаток визита = 13000 − 5000
      const extra = await within(dialog).findByLabelText("Сумма доплаты (факт)");
      expect(extra).toHaveValue("8 000 ₸");

      await user.click(
        within(dialog).getByRole("button", { name: "Выдать костюмы" }),
      );

      await waitFor(() => expect(issued).toHaveLength(1));
      expect(issued[0].visitId).toBe("1");
      expect(issued[0].body).toEqual({
        additionalPayment: 8000,
        deposit: { type: "document" },
        notes: "",
      });
    });

    it("allows zero as the extra payment", async () => {
      const { issued } = mockBackend();
      const user = userEvent.setup();
      const dialog = await openVisitModal(user);

      const extra = await within(dialog).findByLabelText("Сумма доплаты (факт)");
      await user.click(extra);
      await user.keyboard("{Control>}a{/Control}0");
      await user.click(
        within(dialog).getByRole("button", { name: "Выдать костюмы" }),
      );

      await waitFor(() => expect(issued).toHaveLength(1));
      expect(issued[0].body).toMatchObject({ additionalPayment: 0 });
    });

    it("asks for the amount only for a cash deposit and sends it", async () => {
      const { issued } = mockBackend();
      const user = userEvent.setup();
      const dialog = await openVisitModal(user);
      await within(dialog).findByLabelText("Сумма доплаты (факт)");
      expect(
        within(dialog).queryByLabelText("Сумма залога"),
      ).not.toBeInTheDocument();

      await user.click(within(dialog).getByText("Нал"));
      const amount = await within(dialog).findByLabelText("Сумма залога");
      await user.type(amount, "5000");
      await user.type(
        within(dialog).getByLabelText("Комментарий к выдаче"),
        "доплатят завтра",
      );
      await user.click(
        within(dialog).getByRole("button", { name: "Выдать костюмы" }),
      );

      await waitFor(() => expect(issued).toHaveLength(1));
      expect(issued[0].body).toEqual({
        additionalPayment: 8000,
        deposit: { type: "cash", amount: 5000 },
        notes: "доплатят завтра",
      });
    });

    it.each(["Док", "Нет"])(
      "does not show the deposit amount for the %s deposit",
      async (label) => {
        const { issued } = mockBackend();
        const user = userEvent.setup();
        const dialog = await openVisitModal(user);
        await within(dialog).findByLabelText("Сумма доплаты (факт)");

        await user.click(within(dialog).getByText("Нал"));
        await within(dialog).findByLabelText("Сумма залога");
        await user.click(within(dialog).getByText(label));

        expect(
          within(dialog).queryByLabelText("Сумма залога"),
        ).not.toBeInTheDocument();
        await user.click(
          within(dialog).getByRole("button", { name: "Выдать костюмы" }),
        );
        await waitFor(() => expect(issued).toHaveLength(1));
        expect(issued[0].body).toMatchObject({
          deposit: { type: label === "Док" ? "document" : "none" },
        });
        expect(issued[0].body.deposit).not.toHaveProperty("amount");
      },
    );

    it("sends the request once even if the button is clicked twice", async () => {
      const { issued } = mockBackend(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return new HttpResponse(null, { status: 201 });
      });
      const user = userEvent.setup();
      const dialog = await openVisitModal(user);
      await within(dialog).findByLabelText("Сумма доплаты (факт)");
      const button = within(dialog).getByRole("button", {
        name: "Выдать костюмы",
      });

      await user.click(button);
      await user.click(button);

      await waitFor(() => expect(issued).toHaveLength(1));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(issued).toHaveLength(1);
    });

    it("closes the modal and removes the visit from the list after a successful issue", async () => {
      const showSpy = vi.spyOn(notifications, "show");
      mockBackend();
      const user = userEvent.setup();
      const dialog = await openVisitModal(user);
      await within(dialog).findByLabelText("Сумма доплаты (факт)");

      await user.click(
        within(dialog).getByRole("button", { name: "Выдать костюмы" }),
      );

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(screen.queryByText("#1648")).not.toBeInTheDocument();
      expect(
        screen.getByText("На эти даты заказов нет"),
      ).toBeInTheDocument();
      // текст как в коде; по domain.md §4.3 ожидается «Костюмы выданы. Визит 1648» (T-075)
      expect(showSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Заказ успешно выданы клиенту!",
          color: "green",
        }),
      );
    });

    it.todo(
      "shows the toast «Костюмы выданы. Визит 1648» after a successful issue (T-075)",
    );

    it("keeps the modal open when the backend rejects the issue", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { issued } = mockBackend(() =>
        HttpResponse.json(
          { statusCode: 400, message: "Выдать можно только забронированный визит" },
          { status: 400 },
        ),
      );
      const user = userEvent.setup();
      const dialog = await openVisitModal(user);
      await within(dialog).findByLabelText("Сумма доплаты (факт)");

      await user.click(
        within(dialog).getByRole("button", { name: "Выдать костюмы" }),
      );

      await waitFor(() => expect(issued).toHaveLength(1));
      await waitFor(() =>
        expect(
          within(dialog).getByRole("button", { name: "Выдать костюмы" }),
        ).toBeEnabled(),
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("#1648")).toBeInTheDocument(); // визит остался в списке
    });

    it("cancels the visit with a reason only after an explicit confirmation", async () => {
      const { cancelled, issued } = mockBackend();
      const user = userEvent.setup();
      const dialog = await openVisitModal(user);
      await within(dialog).findByLabelText("Сумма доплаты (факт)");

      await user.click(
        within(dialog).getByRole("button", { name: "Отменить визит" }),
      );
      expect(cancelled).toHaveLength(0);
      await user.type(
        within(dialog).getByPlaceholderText(/причину отмены/),
        "клиент передумал",
      );
      const confirm = within(dialog).getAllByRole("button", {
        name: "Отменить визит",
      });
      await user.click(confirm[confirm.length - 1]);

      await waitFor(() => expect(cancelled).toEqual([{ reason: "клиент передумал" }]));
      expect(issued).toHaveLength(0);
    });
  });
});

describe("IssuePage on a phone", () => {
  it("renders the visit as a card and opens the issue modal from it", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: true,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
          onchange: null,
        }) as unknown as MediaQueryList,
    );
    mockBackend();
    const user = userEvent.setup();
    renderWithProviders(<IssuePage />);

    await user.click(await screen.findByRole("button", { name: /Оформить/ }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
