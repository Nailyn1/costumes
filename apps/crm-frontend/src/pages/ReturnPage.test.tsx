import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { API_URL, server } from "../../test/server";
import { ReturnPage } from "./ReturnPage";

type DepositInfo = { type: "cash" | "document" | "none"; amount?: number };
type Balance = { totalRent: number; totalPrepayment: number; totalReceived: number; totalRefunded: number; signedBalance: number; debt: number; refundDue: number };
const paidBalance: Balance = { totalRent: 13000, totalPrepayment: 5000, totalReceived: 8000, totalRefunded: 0, signedBalance: 0, debt: 0, refundDue: 0 };
const debtBalance: Balance = { ...paidBalance, totalReceived: 5000, signedBalance: 3000, debt: 3000 };
const refundBalance: Balance = { ...paidBalance, totalReceived: 10000, signedBalance: -2000, refundDue: 2000 };

const issuedVisit = {
  visitId: 1,
  visitCode: "1648",
  clientName: "Алия",
  clientPhone: "+77071234567",
  startDateTime: "2026-12-20",
  endDateTime: "2026-12-21",
  childrenNames: "Маша, Даша",
  costumesNames: "Эльза, Анна",
  deposit: { type: "cash", amount: 5000 } as DepositInfo,
};

function visitForReturn(deposit: DepositInfo, balance: Balance) {
  return {
    visitId: 1,
    visitCode: "1648",
    client: { name: "Алия", phone: "+77071234567" },
    startDateTime: "2026-12-20",
    endDateTime: "2026-12-21",
    notes: "",
    deposit,
    balance,
    orders: [
      {
        orderId: 11,
        childName: "Маша",
        costumeName: "Эльза",
        inventoryCode: "C-0128",
        rentPrice: 8000,
        prepaymentAmount: 3000,
        finalPayment: 5000,
        returned: false,
      },
      {
        orderId: 12,
        childName: "Даша",
        costumeName: "Анна",
        inventoryCode: "C-0129",
        rentPrice: 5000,
        prepaymentAmount: 2000,
        finalPayment: 3000,
        returned: false,
      },
    ],
  };
}

const page = (items: unknown[]) => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  hasMore: false,
});

interface MockOptions {
  deposit?: DepositInfo;
  balance?: Balance;
  completeReturn?: () => Response | Promise<Response>;
}

/** Бэкенд страницы возврата: список «Ожидают возврата», карточка визита и мутации. */
function mockBackend({ deposit = { type: "cash", amount: 5000 }, balance = paidBalance, completeReturn }: MockOptions = {}) {
  const completed: Array<Record<string, unknown>> = [];
  const unissued: string[] = [];
  const searchQueries: string[] = [];
  server.use(
    http.get(`${API_URL}/visits/issued`, () =>
      HttpResponse.json(page([{ ...issuedVisit, deposit }])),
    ),
    http.get(`${API_URL}/visits/return-search`, ({ request }) => {
      searchQueries.push(new URL(request.url).searchParams.get("q") ?? "");
      return HttpResponse.json([
        {
          visitId: 1,
          visitCode: "1648",
          childrenNames: "Маша, Даша",
          costumesNames: "Эльза, Анна",
          returnDate: "2026-12-21",
          clientPhone: "+77071234567",
          clientName: "Алия",
        },
      ]);
    }),
    http.get(`${API_URL}/visits/1/for-return`, () =>
      HttpResponse.json(visitForReturn(deposit, balance)),
    ),
    http.post(`${API_URL}/visits/1/complete-return`, async ({ request }) => {
      completed.push((await request.json()) as Record<string, unknown>);
      return completeReturn
        ? completeReturn()
        : HttpResponse.json(
            {
              visitId: 1,
              visitCode: "1648",
              status: "completed",
              message: "ok",
              balance,
            },
            { status: 201 },
          );
    }),
    http.post(`${API_URL}/visits/1/unissue`, () => {
      unissued.push("1");
      return new HttpResponse(null, { status: 201 });
    }),
  );
  return { completed, unissued, searchQueries };
}

type User = ReturnType<typeof userEvent.setup>;

async function openReturnModal(user: User) {
  renderWithProviders(<ReturnPage />);
  await user.click(await screen.findByRole("button", { name: /Оформить/ }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("Алия");
  return dialog;
}

const returnButton = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: "Костюмы возвращены" });

async function selectAllCostumes(user: User, dialog: HTMLElement) {
  await user.click(within(dialog).getByText("Эльза"));
  await user.click(within(dialog).getByText("Анна"));
}

describe("ReturnPage: awaiting list", () => {
  it("lists issued visits and shows a hint when there are none", async () => {
    mockBackend();
    server.use(
      http.get(`${API_URL}/visits/issued`, () => HttpResponse.json(page([]))),
    );

    renderWithProviders(<ReturnPage />);

    expect(await screen.findByText("Список пуст")).toBeInTheDocument();
  });

  it("shows the visit card with client, phone, costumes and dates", async () => {
    mockBackend();
    renderWithProviders(<ReturnPage />);

    expect(await screen.findByText("#1648")).toBeInTheDocument();
    expect(screen.getByText("Алия")).toBeInTheDocument();
    expect(screen.getByText(/Костюмы: Эльза, Анна/)).toBeInTheDocument();
  });

  it("searches issued visits only for 2+ characters and opens the chosen one", async () => {
    const { searchQueries } = mockBackend();
    const user = userEvent.setup();
    renderWithProviders(<ReturnPage />);
    await screen.findByText("#1648");
    const input = screen.getByPlaceholderText(/Возврат: поиск/);

    await user.type(input, "А");
    await new Promise((resolve) => setTimeout(resolve, 600)); // дебаунс 400 мс
    expect(searchQueries).toEqual([]);

    await user.type(input, "лия");
    await waitFor(
      () => expect(screen.getAllByText("#1648")).toHaveLength(2),
      { timeout: 3000 },
    );
    expect(searchQueries.at(-1)).toBe("Алия");
    const option = screen
      .getAllByText("#1648")
      .find((el) => el.closest("[data-combobox-option]"));
    await user.click(option as HTMLElement);

    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("Возврат визита #1648"),
    ).toBeInTheDocument();
  });
});

describe("ReturnPage: return modal", () => {
  it("starts with no costume checked and enables return only after all are checked (T-073)", async () => {
    const { completed } = mockBackend();
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);

    const costumeCheckboxes = within(dialog).getAllByRole("checkbox", {
      name: "",
    });
    expect(costumeCheckboxes).toHaveLength(2);
    for (const checkbox of costumeCheckboxes) {
      expect(checkbox).not.toBeChecked();
    }
    expect(returnButton(dialog)).toBeDisabled();

    await user.click(within(dialog).getByText("Эльза"));
    expect(costumeCheckboxes[0]).toBeChecked();
    expect(costumeCheckboxes[1]).not.toBeChecked();
    expect(returnButton(dialog)).toBeDisabled();

    await user.click(within(dialog).getByText("Анна"));
    expect(costumeCheckboxes[1]).toBeChecked();
    expect(returnButton(dialog)).toBeEnabled();
    expect(completed).toHaveLength(0);
  });

  it("disables «Костюмы возвращены» while any costume is unchecked and enables it again when all are checked", async () => {
    const { completed } = mockBackend();
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);

    await selectAllCostumes(user, dialog);
    expect(returnButton(dialog)).toBeEnabled();
    await user.click(within(dialog).getByText("Эльза"));

    expect(returnButton(dialog)).toBeDisabled();
    expect(
      within(dialog).getByText(
        "Кнопка станет активной, когда вы отметите все костюмы",
      ),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByText("Эльза"));

    expect(returnButton(dialog)).toBeEnabled();
    // отметки ничего не сохраняют — запроса на сервер не было
    expect(completed).toHaveLength(0);
  });

  it("sends depositReturned and the comment with complete-return, then closes and drops the visit", async () => {
    const { completed } = mockBackend();
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);

    await user.type(
      within(dialog).getByLabelText("Комментарий при возврате"),
      "сдали вовремя",
    );
    await selectAllCostumes(user, dialog);
    await user.click(returnButton(dialog));

    await waitFor(() => expect(completed).toHaveLength(1));
    expect(completed[0]).toEqual({
      depositReturned: true,
      notes: "сдали вовремя",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("#1648")).not.toBeInTheDocument();
  });

  it("sends depositReturned=false when the «Залог возвращён клиенту» checkbox is cleared", async () => {
    const { completed } = mockBackend();
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);

    await user.click(within(dialog).getByLabelText("Залог возвращён клиенту"));
    await selectAllCostumes(user, dialog);
    await user.click(returnButton(dialog));

    await waitFor(() => expect(completed).toHaveLength(1));
    expect(completed[0]).toMatchObject({ depositReturned: false });
  });

  it("hides the deposit checkbox for a visit without a deposit and shows «Без залога»", async () => {
    const { completed } = mockBackend({ deposit: { type: "none" } });
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);

    expect(within(dialog).getByText("Без залога")).toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText("Залог возвращён клиенту"),
    ).not.toBeInTheDocument();

    await selectAllCostumes(user, dialog);
    await user.click(returnButton(dialog));
    await waitFor(() => expect(completed).toHaveLength(1));
    expect(completed[0]).toMatchObject({ depositReturned: false });
  });

  it("shows the cash deposit amount in the header", async () => {
    mockBackend();
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);

    expect(within(dialog).getByText("5000 ₸")).toBeInTheDocument();
  });

  it("records an optional debt payment separately from the deposit during return", async () => {
    const { completed } = mockBackend({ balance: debtBalance });
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);

    expect(within(dialog).getByText("Долг клиента: 3000 ₸")).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("Принять оплату долга сейчас"));
    await user.clear(within(dialog).getByLabelText("Получено от клиента"));
    await user.type(within(dialog).getByLabelText("Получено от клиента"), "1200");
    await selectAllCostumes(user, dialog);
    await user.click(returnButton(dialog));

    await waitFor(() => expect(completed).toHaveLength(1));
    expect(completed[0]).toMatchObject({
      depositReturned: true,
      settlement: { kind: "debt_payment", amount: 1200 },
    });
  });

  it("allows return with an unpaid balance", async () => {
    const { completed } = mockBackend({ balance: debtBalance });
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);
    await selectAllCostumes(user, dialog);
    await user.click(returnButton(dialog));
    await waitFor(() => expect(completed).toHaveLength(1));
    expect(completed[0]).not.toHaveProperty("settlement");
  });

  it("records a customer refund during return without treating it as a deposit", async () => {
    const { completed } = mockBackend({ balance: refundBalance });
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);
    expect(within(dialog).getByText("Вернуть клиенту: 2000 ₸")).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("Вернуть переплату сейчас"));
    await selectAllCostumes(user, dialog);
    await user.click(returnButton(dialog));
    await waitFor(() => expect(completed).toHaveLength(1));
    expect(completed[0]).toMatchObject({ settlement: { kind: "customer_refund", amount: 2000 } });
  });

  it("keeps the modal open when the backend rejects the return", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { completed } = mockBackend({
      completeReturn: () =>
        HttpResponse.json(
          { statusCode: 400, message: "Визит уже закрыт" },
          { status: 400 },
        ),
    });
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);

    await selectAllCostumes(user, dialog);
    await user.click(returnButton(dialog));

    await waitFor(() => expect(completed).toHaveLength(1));
    await waitFor(() => expect(returnButton(dialog)).toBeEnabled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("#1648")).toBeInTheDocument();
  });

  it("rolls the issue back only after an explicit confirmation", async () => {
    const { unissued, completed } = mockBackend();
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);

    await user.click(
      within(dialog).getByRole("button", { name: "Откатить выдачу" }),
    );
    expect(unissued).toHaveLength(0);
    await user.click(within(dialog).getByRole("button", { name: "Подтвердить" }));

    await waitFor(() => expect(unissued).toEqual(["1"]));
    expect(completed).toHaveLength(0);
  });
});

describe("ReturnPage: forgotten deposits", () => {
  const forgotten = {
    visitId: 1,
    visitCode: "1648",
    childrenNames: "Маша, Даша",
    costumeNames: "Эльза, Анна",
    startDateTime: "2026-12-20",
    endDateTime: "2026-12-21",
    clientPhone: "+77071234567",
    clientName: "Алия",
    deposit: { type: "cash", amount: 5000 },
    notes: "",
  };

  /** Список забытых залогов: после отметки возврата сервер перестаёт его отдавать. */
  function mockDeposits() {
    let returned = false;
    const marked: Array<Record<string, unknown>> = [];
    server.use(
      http.get(`${API_URL}/visits/issued`, () => HttpResponse.json(page([]))),
      http.get(`${API_URL}/visits/unreturned-deposits`, () =>
        HttpResponse.json(page(returned ? [] : [forgotten])),
      ),
      http.post(
        `${API_URL}/visits/1/mark-deposit-returned`,
        async ({ request }) => {
          marked.push((await request.json()) as Record<string, unknown>);
          returned = true;
          return HttpResponse.json({
            visitId: 1,
            depositReturned: true,
            message: "ok",
          });
        },
      ),
    );
    return { marked };
  }

  it("shows visits with an unreturned deposit on the «Забытые залоги» tab", async () => {
    mockDeposits();
    const user = userEvent.setup();
    renderWithProviders(<ReturnPage />);

    await user.click(screen.getByText("Забытые залоги"));

    expect(await screen.findByText("#1648")).toBeInTheDocument();
    expect(screen.getByText("Алия")).toBeInTheDocument();
    expect(screen.getByText(/Костюм: Эльза, Анна/)).toBeInTheDocument();
  });

  it("shows the cash deposit amount in tenge on the deposit card", async () => {
    mockDeposits();
    const user = userEvent.setup();
    renderWithProviders(<ReturnPage />);

    await user.click(screen.getByText("Забытые залоги"));

    expect(await screen.findByText("5000 ₸")).toBeInTheDocument();
  });

  it("asks for confirmation, then marks the deposit as returned and removes the card", async () => {
    const { marked } = mockDeposits();
    const user = userEvent.setup();
    renderWithProviders(<ReturnPage />);
    await user.click(screen.getByText("Забытые залоги"));
    await user.click(await screen.findByRole("button", { name: "Отдать залог" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Алия")).toBeInTheDocument();
    expect(marked).toHaveLength(0); // пока только вопрос

    await user.type(
      within(dialog).getByPlaceholderText(/Например: забрали/),
      "забрали 29.03",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Подтвердить возврат" }),
    );

    await waitFor(() => expect(marked).toEqual([{ notes: "забрали 29.03" }]));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // список обновился после мутации
    expect(await screen.findByText("Нет забытых залогов")).toBeInTheDocument();
  });
});

describe("ReturnPage: unsettled balances", () => {
  it("shows completed overpayment and records a partial refund", async () => {
    const settlements: Array<Record<string, unknown>> = [];
    server.use(
      http.get(`${API_URL}/visits/unsettled-balances`, () =>
        HttpResponse.json(page([{ visitId: 1, visitCode: "1648", clientName: "Алия", clientPhone: "+77071234567", balance: refundBalance }])),
      ),
      http.get(`${API_URL}/visits/1/balance`, () => HttpResponse.json(refundBalance)),
      http.post(`${API_URL}/visits/1/settlement`, async ({ request }) => {
        settlements.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ ...refundBalance, totalRefunded: 1000, signedBalance: -1000, refundDue: 1000 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ReturnPage />);
    await user.click(screen.getByText("Незакрытые расчёты"));
    expect(await screen.findByText("К возврату: 2000 ₸")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Открыть расчёт" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Вернуть клиенту: 2000 ₸");
    await user.clear(within(dialog).getByLabelText("Выдано клиенту"));
    await user.type(within(dialog).getByLabelText("Выдано клиенту"), "1000");
    await user.click(within(dialog).getByRole("button", { name: "Записать возврат" }));
    await waitFor(() => expect(settlements).toEqual([{ kind: "customer_refund", amount: 1000 }]));
  });
});
