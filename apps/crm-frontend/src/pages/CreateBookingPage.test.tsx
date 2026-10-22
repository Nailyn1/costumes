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
import { clientKeys } from '../features/clients-children/hooks/useClients';
import { useAuthStore } from "../stores/auth.store";
import {
  savePendingQuickIssueRequest,
} from "../features/visits/utils/quickIssueRequestStorage";
import type { QuickIssueVisitRequestDto } from "@costumes/shared";

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
  whatsappConfirmed: false,
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
  const whatsappChecks = vi.fn();
  // Контракт preview-code возвращает JSON-строку, которую клиент разбирает как код.
  const previewCode = vi.fn(
    () => HttpResponse.json("1648", { status: 201 }),
  );
  server.use(
    http.get(`${API_URL}/clients/search`, () => HttpResponse.json([aliya])),
    http.get(`${API_URL}/clients/:clientId/whatsapp-availability`, () => {
      whatsappChecks();
      return HttpResponse.json({ status: 'exists' });
    }),
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
  return { created, costumeQueries, previewCode, whatsappChecks };
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

async function prepareQuickReview(user: User) {
  await user.click(screen.getByText("Выдать сейчас"));
  await pickClient(user);
  await pickChild(user, "Маша");
  await pickCostume(user, "Эль", /Эльза \(C-0128\)/);
  await fillMoney(user, "Аренда", "8000");
  await user.click(screen.getByRole("button", { name: "Проверить и выдать" }));
  return screen.findByRole("dialog");
}

beforeEach(() => {
  // «сегодня» = 10 декабря 2026: от него считаются умные даты
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-12-10T09:00:00") });
  window.sessionStorage.clear();
  useAuthStore.getState().logout();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  useAuthStore.getState().logout();
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

  it('allows a visit without WhatsApp and turns notification off', async () => {
    const { created } = mockBackend();
    server.use(http.get(`${API_URL}/clients/:clientId/whatsapp-availability`, () =>
      HttpResponse.json({ status: 'absent' })));
    const user = userEvent.setup();
    renderPage();
    await pickClient(user);
    expect(await screen.findByText(/WhatsApp не найден/, undefined, SEARCH_TIMEOUT)).toBeInTheDocument();
    await fillDates(user, '20');
    await fillFirstOrder(user, '8000', '3000');
    const dialog = await openPreview(user);
    expect(within(dialog).getByText(/сообщите код выдачи клиенту лично/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Отправить клиенту уведомление/)).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить и создать' }));
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].sendNotification).toBe('false');
  });

  it('loads the phone for preview when selection cache is missing', async () => {
    const { created } = mockBackend();
    server.use(
      http.get(`${API_URL}/clients/detail/:clientId`, () => HttpResponse.json({
        client: { ...aliya, phone: '+77079990001' }, visits: [],
      })),
      http.get(`${API_URL}/clients/:clientId/whatsapp-availability`, () => HttpResponse.json({ status: 'absent' })),
    );
    const user = userEvent.setup();
    const { queryClient } = renderPage();
    await pickClient(user);
    await fillDates(user, '20');
    await fillFirstOrder(user, '8000', '3000');
    queryClient.removeQueries({ queryKey: clientKeys.formState('1') });
    const dialog = await openPreview(user);
    expect(await within(dialog).findByText(/\+77079990001/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Отправить клиенту уведомление/)).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить и создать' }));
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].sendNotification).toBe('false');
  });

  it('allows a visit when WhatsApp availability is unknown', async () => {
    const { created } = mockBackend();
    server.use(http.get(`${API_URL}/clients/:clientId/whatsapp-availability`, () =>
      HttpResponse.json({ status: 'unknown' })));
    const user = userEvent.setup();
    renderPage();
    await pickClient(user);
    expect(await screen.findByText(/Не удалось проверить WhatsApp/, undefined, SEARCH_TIMEOUT)).toBeInTheDocument();
    await fillDates(user, '20');
    await fillFirstOrder(user, '8000', '3000');
    const dialog = await openPreview(user);
    expect(within(dialog).getByLabelText(/Отправить клиенту уведомление/)).not.toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить и создать' }));
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].sendNotification).toBe('true');
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
          whatsappConfirmed: false,
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

  it("creates an immediate issue without WhatsApp and keeps selections when return date changes", async () => {
    const { whatsappChecks } = mockBackend();
    useAuthStore.getState().setAuth({
      accessToken: "test-token",
      user: { login: "quick-operator", name: "Оператор" },
    });
    const requests: Record<string, unknown>[] = [];
    server.use(
      http.post(`${API_URL}/visits/quick-issue`, async ({ request }) => {
        requests.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          visitId: 321,
          visitCode: "1648",
          status: "issued",
          version: 1,
          balance: {
            totalRent: 8000,
            totalPrepayment: 0,
            totalReceived: 9000,
            totalRefunded: 0,
            signedBalance: -1000,
            debt: 0,
            refundDue: 1000,
          },
        }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Выдать сейчас"));
    await pickClient(user);
    await pickChild(user, "Маша");
    await pickCostume(user, "Эль", /Эльза \(C-0128\)/);
    await fillMoney(user, "Аренда", "8000");

    const returnDate = screen.getByLabelText("Дата возврата");
    await user.clear(returnDate);
    await user.type(returnDate, "12{Enter}");
    expect(returnDate).toHaveValue("12.12");
    expect(screen.getByText("Маша")).toBeInTheDocument();
    expect(screen.getByText("Эльза")).toBeInTheDocument();

    await fillMoney(user, "Получено сейчас", "9000");
    await user.click(screen.getByRole("radio", { name: "Деньги" }));
    await fillMoney(user, "Сумма денежного залога", "5000");
    const dialog = await (async () => {
      await user.click(screen.getByRole("button", { name: "Проверить и выдать" }));
      return screen.findByRole("dialog");
    })();
    expect(within(dialog).getByText(/Маша — Эльза/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Возврат: 12\.12\.2026 до 18:00/)).toBeInTheDocument();
    expect(within(dialog).getByText("Залог: Деньги · 5 000 ₸")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Подтвердить и выдать" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      clientId: 1,
      visitCode: "1648",
      startDateTime: "2026-12-10",
      issueTimeFrom: "09:00",
      issueTimeTo: "09:00",
      endDateTime: "2026-12-12",
      returnTimeUntil: "18:00",
      additionalPayment: 9000,
      deposit: { type: "cash", amount: 5000 },
      orders: [{ childId: 10, costumeId: 5, rentPrice: 8000 }],
    });
    expect((requests[0].orders as Record<string, unknown>[])[0]).not.toHaveProperty("prepaymentAmount");
    expect(requests[0]).not.toHaveProperty("sendNotification");
    expect(whatsappChecks).not.toHaveBeenCalled();
    expect(requests[0]).toMatchObject({ endDateTime: "2026-12-12" });
    expect(await screen.findByRole("link", { name: "Открыть визит" })).toHaveAttribute(
      "href",
      "/bookings/visits/321",
    );
  });

  it("retries an ambiguous 401/5xx sequence with the exact command body", async () => {
    const { whatsappChecks } = mockBackend();
    useAuthStore.getState().setAuth({
      accessToken: "test-token",
      user: { login: "quick-operator", name: "Оператор" },
    });
    const requests: Record<string, unknown>[] = [];
    let issueCalls = 0;
    server.use(
      http.post(`${API_URL}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: "refreshed-token" }, { status: 201 }),
      ),
      http.post(`${API_URL}/visits/quick-issue`, async ({ request }) => {
        requests.push((await request.json()) as Record<string, unknown>);
        issueCalls += 1;
        if (issueCalls === 1) return HttpResponse.json({ statusCode: 401, message: "expired" }, { status: 401 });
        if (issueCalls === 2) return HttpResponse.json({ statusCode: 503, message: "unknown" }, { status: 503 });
        return HttpResponse.json({
          visitId: 321,
          visitCode: "1648",
          status: "issued",
          version: 1,
          balance: { totalRent: 8000, totalPrepayment: 0, totalReceived: 0, totalRefunded: 0, signedBalance: 8000, debt: 8000, refundDue: 0 },
        }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await prepareQuickReview(user);
    await user.click(within(dialog).getByRole("button", { name: "Подтвердить и выдать" }));
    expect(await screen.findByRole("button", { name: "Повторить выдачу" })).toBeInTheDocument();
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual(requests[1]);
    expect(whatsappChecks).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Повторить выдачу" }));
    await screen.findByRole("link", { name: "Открыть визит" });
    expect(requests).toHaveLength(3);
    expect(requests[0]).toEqual(requests[2]);
  });

  it("keeps an unknown 409 frozen for retry and releases a code-expired command for a new code", async () => {
    mockBackend();
    useAuthStore.getState().setAuth({
      accessToken: "test-token",
      user: { login: "quick-operator", name: "Оператор" },
    });
    const requests: Record<string, unknown>[] = [];
    let issueCalls = 0;
    server.use(
      http.post(`${API_URL}/visits/quick-issue`, async ({ request }) => {
        requests.push((await request.json()) as Record<string, unknown>);
        issueCalls += 1;
        if (issueCalls === 1) return HttpResponse.json({ statusCode: 409, message: "in progress", code: "RECEIPT_IN_PROGRESS" }, { status: 409 });
        if (issueCalls === 2) return HttpResponse.json({ statusCode: 409, message: "expired", code: "QUICK_ISSUE_CODE_EXPIRED" }, { status: 409 });
        return HttpResponse.json({
          visitId: 321,
          visitCode: "1648",
          status: "issued",
          version: 1,
          balance: { totalRent: 8000, totalPrepayment: 0, totalReceived: 0, totalRefunded: 0, signedBalance: 8000, debt: 8000, refundDue: 0 },
        }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const firstDialog = await prepareQuickReview(user);
    await user.click(within(firstDialog).getByRole("button", { name: "Подтвердить и выдать" }));
    await screen.findByRole("button", { name: "Повторить выдачу" });
    await user.click(screen.getByRole("button", { name: "Повторить выдачу" }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0]).toEqual(requests[1]);
    expect(await screen.findByRole("button", { name: "Проверить и выдать" })).toBeInTheDocument();

    const secondDialogPromise = (async () => {
      await user.click(screen.getByRole("button", { name: "Проверить и выдать" }));
      return screen.findByRole("dialog");
    })();
    const secondDialog = await secondDialogPromise;
    await user.click(within(secondDialog).getByRole("button", { name: "Подтвердить и выдать" }));
    await screen.findByRole("link", { name: "Открыть визит" });
    expect(requests).toHaveLength(3);
    expect(requests[2].commandId).not.toBe(requests[0].commandId);
  });

  it("keeps the booking prepayment draft when toggling quick issue and back", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderPage();

    await pickClient(user);
    await fillDates(user, "20");
    await fillFirstOrder(user, "8000", "3000");
    await user.click(screen.getByText("Выдать сейчас"));
    expect(screen.getByText("Предоплата из черновика брони не переносится.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Предоплата")).not.toBeInTheDocument();
    const returnDate = screen.getByLabelText("Дата возврата");
    await user.clear(returnDate);
    await user.type(returnDate, "12{Enter}");
    await fillMoney(user, "Получено сейчас", "9000");
    await user.click(screen.getByRole("radio", { name: "Деньги" }));
    await fillMoney(user, "Сумма денежного залога", "5000");

    await user.click(screen.getByText("Бронь"));
    expect(screen.getByLabelText("Предоплата")).toHaveValue("3 000 ₸");
    await user.click(screen.getByText("Выдать сейчас"));
    expect(screen.getByLabelText("Дата возврата")).toHaveValue("12.12");
    expect(screen.getByLabelText("Получено сейчас")).toHaveValue("9 000 ₸");
    expect(screen.getByRole("radio", { name: "Деньги" })).toBeChecked();
    expect(screen.getByLabelText("Сумма денежного залога")).toHaveValue("5 000 ₸");
  });

  it("restores an unresolved request for the same user immediately after reload", async () => {
    const pending: QuickIssueVisitRequestDto = {
      commandId: "a06d6c16-7f80-4507-b601-e03c2c13a54b",
      clientId: 1,
      visitCode: "1648",
      startDateTime: "2026-12-10",
      issueTimeFrom: "09:00",
      issueTimeTo: "09:00",
      endDateTime: "2026-12-11",
      returnTimeUntil: "18:00",
      orders: [{ childId: 10, costumeId: 5, rentPrice: 8000 }],
      additionalPayment: 9000,
      deposit: { type: "cash", amount: 5000 },
    };
    useAuthStore.getState().setAuth({
      accessToken: "test-token",
      user: { login: "quick-operator", name: "Оператор" },
    });
    expect(savePendingQuickIssueRequest("quick-operator", pending)).toBe(true);
    mockBackend();
    renderPage();

    expect(screen.getByRole("heading", { name: "Быстрая выдача" })).toBeInTheDocument();
    expect(screen.getByText("Код визита: 1648")).toBeInTheDocument();
    expect(screen.getByText(/Получено сейчас: 9 000 ₸/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить выдачу" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Проверить и выдать" })).not.toBeInTheDocument();
  });

  it("does not restore another user's pending quick issue", () => {
    const pending: QuickIssueVisitRequestDto = {
      commandId: "a06d6c16-7f80-4507-b601-e03c2c13a54b",
      clientId: 1,
      visitCode: "1648",
      startDateTime: "2026-12-10",
      issueTimeFrom: "09:00",
      issueTimeTo: "09:00",
      endDateTime: "2026-12-11",
      returnTimeUntil: "18:00",
      orders: [{ childId: 10, costumeId: 5, rentPrice: 8000 }],
      additionalPayment: 0,
      deposit: { type: "none" },
    };
    useAuthStore.getState().setAuth({
      accessToken: "test-token",
      user: { login: "operator-a", name: "Оператор А" },
    });
    savePendingQuickIssueRequest("operator-a", pending);
    useAuthStore.getState().setAuth({
      accessToken: "other-token",
      user: { login: "operator-b", name: "Оператор Б" },
    });
    mockBackend();
    renderPage();

    expect(screen.getByRole("heading", { name: "Создание брони" })).toBeInTheDocument();
    expect(screen.queryByText("Код визита: 1648")).not.toBeInTheDocument();
  });

  it("does not submit a confirmed request when session storage rejects persistence", async () => {
    const { previewCode } = mockBackend();
    useAuthStore.getState().setAuth({
      accessToken: "test-token",
      user: { login: "quick-operator", name: "Оператор" },
    });
    const issue = vi.fn();
    server.use(
      http.post(`${API_URL}/visits/quick-issue`, () => {
        issue();
        return HttpResponse.error();
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await prepareQuickReview(user);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("storage denied", "QuotaExceededError");
    });
    await user.click(within(dialog).getByRole("button", { name: "Подтвердить и выдать" }));

    expect(previewCode).toHaveBeenCalledOnce();
    expect(issue).not.toHaveBeenCalled();
    expect(await screen.findByText("Не удалось сохранить выдачу для повтора")).toBeInTheDocument();
  });

  it.todo(
    "defaults the times by weekday: weekend 10:00–19:00, return until 19:00 — T-050",
  );
});
