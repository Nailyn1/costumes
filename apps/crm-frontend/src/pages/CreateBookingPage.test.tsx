import { notifications } from "@mantine/notifications";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient as appQueryClient } from "src/app/queryClient";
import { QueryClient } from "@tanstack/react-query";
import { renderWithProviders } from "../../test/render";
import { API_URL, server } from "../../test/server";
import { CreateBookingPage } from "./CreateBookingPage";

/**
 * Форма кладёт выбранные сущности в кэш через setQueryData без подписчиков
 * (дети клиента, костюм для превью), поэтому gcTime: 0 из test/render здесь не годится.
 */
function createPageQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPage(queryClient = createPageQueryClient()) {
  return renderWithProviders(<CreateBookingPage />, queryClient);
}

// Debounced search and Mantine interactions can take longer under the full Vitest suite.
const SEARCH_TIMEOUT = { timeout: 6000 };

const aliya = {
  clientId: 1,
  name: "Алия",
  phone: "+77071234567",
  children: [
    { childId: 10, name: "Маша" },
    { childId: 11, name: "Даша" },
  ],
  isBlacklisted: false,
};

const elsa = {
  costumeId: 5,
  name: "Эльза",
  inventoryCode: "C-0128",
  status: "available",
};
const busyAnna = {
  costumeId: 6,
  name: "Анна",
  inventoryCode: "C-0129",
  status: "issued",
};

const createdVisit = {
  id: 100,
  visitCode: "1648",
  status: "reserved",
  client: { id: 1, fullname: "Алия", phone: "+77071234567" },
  visitDate: {
    startDateTime: "2026-12-20",
    endDateTime: "2026-12-21",
    issueTimeFrom: "18:30",
    issueTimeTo: "19:30",
    returnTimeUntil: "18:00",
  },
  notifications: [],
  orders: [],
};

interface CapturedVisit {
  body: Record<string, unknown>;
  sendNotification: string | null;
}

/** Типичные ответы бэкенда для сценария брони; создание визита можно подменить. */
function mockBackend(
  createVisit?: (captured: CapturedVisit) => Response | Promise<Response>,
) {
  const created: CapturedVisit[] = [];
  const costumeQueries: URLSearchParams[] = [];
  // Контракт preview-code возвращает JSON-строку, которую клиент разбирает как код.
  const previewCode = vi.fn(
    () => HttpResponse.json("1648", { status: 201 }),
  );
  server.use(
    http.get(`${API_URL}/clients/search`, () => HttpResponse.json([aliya])),
    http.get(`${API_URL}/costumes/search-available`, ({ request }) => {
      costumeQueries.push(new URL(request.url).searchParams);
      return HttpResponse.json([elsa, busyAnna]);
    }),
    http.post(`${API_URL}/visits/preview-code`, previewCode),
    http.post(`${API_URL}/visits`, async ({ request }) => {
      const captured = {
        body: (await request.json()) as Record<string, unknown>,
        sendNotification: new URL(request.url).searchParams.get(
          "sendNotification",
        ),
      };
      created.push(captured);
      return createVisit
        ? createVisit(captured)
        : HttpResponse.json(createdVisit, { status: 201 });
    }),
  );
  return { created, costumeQueries, previewCode };
}

type User = ReturnType<typeof userEvent.setup>;

async function pickClient(user: User) {
  await user.type(screen.getByPlaceholderText("Имя или телефон"), "Али");
  const option = await screen.findByText(/Алия/, undefined, SEARCH_TIMEOUT);
  await user.click(option);
  await screen.findByText("Алия"); // карточка выбранного клиента
}

async function fillDates(user: User, issueDay = "20") {
  const issue = screen.getByLabelText("Дата выдачи");
  await user.click(issue);
  await user.type(issue, `${issueDay}{Enter}`);
}

async function pickChild(user: User, name: string) {
  await user.click(screen.getByPlaceholderText("Выберите ребенка"));
  await user.click(await screen.findByText(name, { selector: "[data-combobox-option] *, [data-combobox-option]" }));
}

/** Поле поиска костюма: у него нет label, поэтому ищем внутри блока «Костюм». */
async function findCostumeInput() {
  const title = await screen.findByText("Костюм", { selector: "p" });
  const block = title.parentElement?.parentElement as HTMLElement;
  return within(block).getByRole("combobox");
}

async function pickCostume(user: User, query: string, optionText: RegExp) {
  const select = await findCostumeInput();
  await user.type(select, query);
  const option = await screen.findByText(optionText, undefined, SEARCH_TIMEOUT);
  await user.click(option);
}

async function fillMoney(user: User, label: string, value: string) {
  const input = screen.getByLabelText(label);
  await user.click(input);
  await user.clear(input);
  await user.type(input, value);
}

async function fillFirstOrder(user: User, rent: string, prepayment: string) {
  await pickChild(user, "Маша");
  await pickCostume(user, "Эль", /Эльза \(C-0128\)/);
  await fillMoney(user, "Аренда", rent);
  await fillMoney(user, "Предоплата", prepayment);
}

async function openPreview(user: User) {
  await user.click(screen.getByRole("button", { name: "Проверить" }));
  return screen.findByRole("dialog");
}

beforeEach(() => {
  // «сегодня» = 10 декабря 2026: от него считаются умные даты
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-12-10T09:00:00") });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CreateBookingPage", () => {
  it("shows required-field errors in Russian and does not reserve a visit code", async () => {
    const { created, previewCode } = mockBackend();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Проверить" }));

    expect(await screen.findByText("Выберите клиента")).toBeInTheDocument();
    expect(screen.getByText("Укажите дату выдачи")).toBeInTheDocument();
    expect(screen.getByText("Укажите дату возврата")).toBeInTheDocument();
    expect(screen.getByText("Введите сумму аренды")).toBeInTheDocument();
    expect(previewCode).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it("fills the return date as issue date + 1 day when the issue date is typed", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderPage();

    await fillDates(user, "20");

    expect(screen.getByLabelText("Дата выдачи")).toHaveValue("20.12");
    expect(screen.getByLabelText("Дата возврата")).toHaveValue("21.12");
  });

  it("requires the client and dates before selection but enables adding a child after client selection (T-071)", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText("Сначала выберите клиента")).toBeInTheDocument();
    expect(
      screen.getByText("Сначала выберите даты визита"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Добавить еще ребенка/ }),
    ).toBeDisabled();

    await pickClient(user);
    expect(
      screen.getByRole("button", { name: /Добавить еще ребенка/ }),
    ).toBeEnabled();
  });

  it("clamps the prepayment to the rent when the rent is lowered below it", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderPage();

    await fillMoney(user, "Аренда", "8000");
    await fillMoney(user, "Предоплата", "5000");
    await user.click(screen.getByLabelText("Аренда"));
    await user.keyboard("{Control>}a{/Control}3");

    // Внесено (5 000) больше новой аренды (3) — ограничивается арендой
    expect(screen.getByLabelText("Предоплата")).toHaveValue("3 ₸");
  });

  it("marks a busy costume as unavailable in the search results", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderPage();
    await pickClient(user);
    await fillDates(user, "20");

    await user.type(await findCostumeInput(), "Ан");

    const busy = await screen.findByText(
      /Анна \(C-0129\) — \[ЗАНЯТ\]/,
      undefined,
      SEARCH_TIMEOUT,
    );
    expect(busy.closest("[data-combobox-option]")).toHaveAttribute(
      "data-combobox-disabled",
      "true",
    );
  });

  it("creates a visit: preview shows code, dates and totals, then POST /visits is sent", async () => {
    const { created, costumeQueries } = mockBackend();
    const user = userEvent.setup();
    renderPage();

    await pickClient(user);
    await fillDates(user, "20");
    await fillFirstOrder(user, "8000", "3000");

    // поиск занятости идёт с датами и временем визита
    expect(costumeQueries[0].get("startDate")).toBe("2026-12-20T18:30");
    expect(costumeQueries[0].get("endDate")).toBe("2026-12-21T18:00");

    const dialog = await openPreview(user);
    expect(within(dialog).getByText("1648")).toBeInTheDocument();
    expect(within(dialog).getByText(/20 декабря/)).toBeInTheDocument();
    expect(within(dialog).getByText(/21 декабря/)).toBeInTheDocument();
    expect(within(dialog).getByText("Маша")).toBeInTheDocument();
    expect(within(dialog).getByText("Эльза")).toBeInTheDocument();
    expect(within(dialog).getByText("C-0128")).toBeInTheDocument();
    // остаток = аренда − внесено; для одного заказа он же — «Итого доплатить»
    expect(within(dialog).getAllByText(/5[\s,]?000 ₸/)).toHaveLength(2);
    expect(created).toHaveLength(0); // пока только превью

    await user.click(
      within(dialog).getByRole("button", { name: "Подтвердить и создать" }),
    );

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].sendNotification).toBe("true");
    expect(created[0].body).toEqual({
      clientId: 1,
      visitCode: "1648",
      startDateTime: "2026-12-20",
      endDateTime: "2026-12-21",
      issueTimeFrom: "18:30",
      issueTimeTo: "19:30",
      returnTimeUntil: "18:00",
      notes: "",
      orders: [
        {
          childId: 10,
          costumeId: 5,
          rentPrice: 8000,
          prepaymentAmount: 3000,
          notes: "",
        },
      ],
    });
  });

  it("sends sendNotification=false when the WhatsApp checkbox is unchecked", async () => {
    const { created } = mockBackend();
    const user = userEvent.setup();
    renderPage();
    await pickClient(user);
    await fillDates(user, "20");
    await fillFirstOrder(user, "8000", "3000");
    const dialog = await openPreview(user);

    await user.click(
      within(dialog).getByLabelText(/Отправить клиенту уведомление в WhatsApp/),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Подтвердить и создать" }),
    );

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].sendNotification).toBe("false");
  });

  it("resets the form after a successful creation", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderPage();
    await pickClient(user);
    await fillDates(user, "20");
    await fillFirstOrder(user, "8000", "3000");
    const dialog = await openPreview(user);

    await user.click(
      within(dialog).getByRole("button", { name: "Подтвердить и создать" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Дата выдачи")).toHaveValue("");
    expect(screen.getByPlaceholderText("Имя или телефон")).toBeInTheDocument();
    expect(
      screen.getByText("Сначала выберите даты визита"),
    ).toBeInTheDocument();
  });

  it("keeps the form and shows the backend message once when creation fails with 400", async () => {
    const showSpy = vi.spyOn(notifications, "show");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { created } = mockBackend(() =>
      HttpResponse.json(
        { statusCode: 400, message: "Клиент находится в чёрном списке", error: "Bad Request" },
        { status: 400 },
      ),
    );
    // глобальный toast ошибок мутаций живёт в queryClient приложения —
    // подключаем его обработчик к тестовому клиенту
    const queryClient = createPageQueryClient();
    queryClient.getMutationCache().config.onError =
      appQueryClient.getMutationCache().config.onError;
    const user = userEvent.setup();
    renderPage(queryClient);
    await pickClient(user);
    await fillDates(user, "20");
    await fillFirstOrder(user, "8000", "3000");
    const dialog = await openPreview(user);

    await user.click(
      within(dialog).getByRole("button", { name: "Подтвердить и создать" }),
    );

    await waitFor(() =>
      expect(showSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Клиент находится в чёрном списке",
          color: "red",
        }),
      ),
    );
    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // превью не закрыто
    expect(screen.getByLabelText("Дата выдачи")).toHaveValue("20.12");
  });

  it("adds extra orders and removes them; the first order has no delete button", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderPage();
    await pickClient(user);

    await user.click(
      screen.getByRole("button", { name: /Добавить еще ребенка/ }),
    );

    expect(screen.getByText("Заказ №1")).toBeInTheDocument();
    const secondTitle = screen.getByText("Заказ №2");
    const firstHeader = screen.getByText("Заказ №1").parentElement as HTMLElement;
    const secondHeader = secondTitle.parentElement as HTMLElement;
    expect(within(firstHeader).queryByRole("button")).not.toBeInTheDocument();

    await user.click(within(secondHeader).getByRole("button"));
    expect(screen.queryByText("Заказ №2")).not.toBeInTheDocument();
  });

  it("creates a client inline with a phone mask and selects it automatically", async () => {
    mockBackend();
    let created: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}/clients`, async ({ request }) => {
        created = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          clientId: 2,
          name: "Мария",
          phone: "+77075554433",
          children: [],
          isBlacklisted: false,
        }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTitle("Создать нового клиента"));
    await user.type(screen.getByLabelText("Имя и Фамилия клиента"), "Мария");
    await user.type(screen.getByPlaceholderText("+7 (___) ___-__-__"), "7075554433");
    await user.click(screen.getByRole("button", { name: "Сохранить и выбрать" }));

    await waitFor(() =>
      expect(created).toEqual({ name: "Мария", phone: "+77075554433" }),
    );
    expect(await screen.findByText("Мария")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Имя или телефон"),
    ).not.toBeInTheDocument(); // клиент выбран, поиск скрыт
  });

  it("requires an explicit prepayment value when the field is empty", async () => {
    const { previewCode } = mockBackend();
    const user = userEvent.setup();
    renderPage();
    await pickClient(user);
    await fillDates(user, "20");
    await pickChild(user, "Маша");
    await pickCostume(user, "Эль", /Эльза \(C-0128\)/);
    await fillMoney(user, "Аренда", "8000");

    await user.click(screen.getByRole("button", { name: "Проверить" }));

    expect(
      await screen.findByText("Введите сумму предоплаты"),
    ).toBeInTheDocument();
    expect(previewCode).not.toHaveBeenCalled();
  });

  it("books a visit with an explicit 0 ₸ prepayment (T-072)", async () => {
    const { created } = mockBackend();
    const user = userEvent.setup();
    renderPage();
    await pickClient(user);
    await fillDates(user, "20");
    await fillFirstOrder(user, "8000", "0");

    const dialog = await openPreview(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Подтвердить и создать" }),
    );

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].body.orders).toEqual([
      expect.objectContaining({ prepaymentAmount: 0 }),
    ]);
  });

  it("shows an error when the pickup window is reversed", async () => {
    mockBackend();
    renderPage();

    fireEvent.change(screen.getByLabelText("Забрать с"), {
      target: { value: "20:00" },
    });

    expect(
      await screen.findByText("Время должно быть позже поля 'Забрать с'"),
    ).toBeInTheDocument();
  });

  it("drops a return date that is earlier than the issue date", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderPage();
    await fillDates(user, "20");

    const ret = screen.getByLabelText("Дата возврата");
    await user.clear(ret);
    await user.type(ret, "15{Enter}");

    expect(ret).toHaveValue("");
  });

  it("resets the orders when the visit dates change", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderPage();
    await pickClient(user);
    await fillDates(user, "20");
    await pickChild(user, "Маша");
    expect(screen.queryByPlaceholderText("Выберите ребенка")).not.toBeInTheDocument();

    const issue = screen.getByLabelText("Дата выдачи");
    await user.clear(issue);
    await user.type(issue, "22{Enter}");

    expect(await screen.findByPlaceholderText("Выберите ребенка")).toBeInTheDocument();
    expect(screen.getByLabelText("Дата возврата")).toHaveValue("23.12");
  });

  // Домен (§4.1): будни 18:30–19:30 / вернуть до 18:00; сб/вс 10:00–19:00 / до 19:00.
  // Сейчас время всегда 18:30/19:30/18:00 и при выборе даты не меняется — фиксируем «как есть».
  it("keeps the weekday default times even when a weekend date is chosen (current behaviour)", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderPage();

    await fillDates(user, "19"); // 19.12.2026 — суббота

    expect(screen.getByLabelText("Забрать с")).toHaveValue("18:30");
    expect(screen.getByLabelText("Забрать до")).toHaveValue("19:30");
    expect(screen.getByLabelText("Вернуть до")).toHaveValue("18:00");
  });

  it("reads the preview code as a JSON string from the API contract (T-070)", async () => {
    const { previewCode } = mockBackend();
    const user = userEvent.setup();
    renderPage();

    await pickClient(user);
    await fillDates(user, "20");
    await fillFirstOrder(user, "8000", "3000");

    const dialog = await openPreview(user);
    expect(previewCode).toHaveBeenCalledOnce();
    expect(within(dialog).getByText("1648")).toBeInTheDocument();
    expect(within(dialog).queryByText("[object Object]")).not.toBeInTheDocument();
  });

  it.todo(
    "defaults the times by weekday: weekend 10:00–19:00, return until 19:00 — T-050",
  );
});
