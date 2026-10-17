import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { API_URL, server } from "../../test/server";
import { ReturnPage } from "./ReturnPage";

type DepositInfo = { type: "cash" | "document" | "none"; amount?: number };

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

function visitForReturn(deposit: DepositInfo) {
  return {
    visitId: 1,
    visitCode: "1648",
    client: { name: "Алия", phone: "+77071234567" },
    startDateTime: "2026-12-20",
    endDateTime: "2026-12-21",
    notes: "",
    deposit,
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
  completeReturn?: () => Response | Promise<Response>;
}

/** Бэкенд страницы возврата: список «Ожидают возврата», карточка визита и мутации. */
function mockBackend({ deposit = { type: "cash", amount: 5000 }, completeReturn }: MockOptions = {}) {
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
      HttpResponse.json(visitForReturn(deposit)),
    ),
    http.post(`${API_URL}/visits/1/complete-return`, async ({ request }) => {
      completed.push((await request.json()) as Record<string, unknown>);
      return completeReturn
        ? completeReturn()
        : HttpResponse.json({
            visitId: 1,
            visitCode: "1648",
            status: "completed",
            message: "ok",
          });
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
  // По domain.md §4.4 костюмы отмечают вручную; в коде все чекбоксы отмечены сразу (T-073).
  it("starts with every costume checked, so the button is enabled (current behaviour)", async () => {
    mockBackend();
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);

    for (const checkbox of within(dialog).getAllByRole("checkbox", {
      name: "",
    })) {
      expect(checkbox).toBeChecked();
    }
    expect(returnButton(dialog)).toBeEnabled();
  });

  it.todo(
    "starts with no costume checked and enables «Костюмы возвращены» only after all are checked (T-073)",
  );

  it("disables «Костюмы возвращены» while any costume is unchecked and enables it again when all are checked", async () => {
    const { completed } = mockBackend();
    const user = userEvent.setup();
    const dialog = await openReturnModal(user);

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

  // DepositCard показывает сумму наличного залога в «₽», а не в «₸».
  it.todo("shows the cash deposit amount in tenge (₸) on the deposit card (T-074)");

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
