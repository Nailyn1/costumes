import { notifications } from "@mantine/notifications";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { queryClient as appQueryClient } from "src/app/queryClient";
import { createTestQueryClient, renderWithProviders } from "../../test/render";
import { API_URL, server } from "../../test/server";
import { ClientsPage } from "./ClientsPage";

type User = ReturnType<typeof userEvent.setup>;

interface ServerState {
  name: string;
  phone: string;
  isBlacklisted: boolean;
  blacklistReason?: string;
  deleted: boolean;
}

/**
 * Мини-бэкенд клиентов: одно состояние, которое меняют мутации,
 * поэтому после инвалидации кэша UI видит уже новые данные.
 */
function mockClientsBackend(initial: Partial<ServerState> = {}) {
  const state: ServerState = {
    name: "Алия",
    phone: "+77071234567",
    isBlacklisted: false,
    deleted: false,
    ...initial,
  };
  const calls = {
    blacklistAdded: [] as Array<Record<string, unknown>>,
    blacklistRemoved: 0,
    updated: [] as Array<Record<string, unknown>>,
    deleted: 0,
    searchQueries: [] as string[],
  };
  const asItem = () => ({
    clientId: 1,
    name: state.name,
    phone: state.phone,
    isBlacklisted: state.isBlacklisted,
  });
  server.use(
    http.get(`${API_URL}/clients/list`, () =>
      HttpResponse.json({
        items: state.deleted ? [] : [asItem()],
        totalOrders: 0,
        total: state.deleted ? 0 : 1,
        page: 1,
        limit: 20,
        hasMore: false,
      }),
    ),
    http.get(`${API_URL}/clients/search`, ({ request }) => {
      calls.searchQueries.push(new URL(request.url).searchParams.get("q") ?? "");
      return HttpResponse.json([{ ...asItem(), children: [] }]);
    }),
    http.get(`${API_URL}/clients/detail/1`, () =>
      HttpResponse.json({
        client: {
          ...asItem(),
          ...(state.blacklistReason
            ? { blacklistReason: state.blacklistReason }
            : {}),
          children: [{ childId: 10, name: "Маша" }],
        },
        visits: [],
      }),
    ),
    http.post(`${API_URL}/clients/1/blacklist`, async ({ request }) => {
      const body = (await request.json()) as { blacklistReason?: string };
      calls.blacklistAdded.push(body);
      state.isBlacklisted = true;
      state.blacklistReason = body.blacklistReason;
      return new HttpResponse(null, { status: 201 });
    }),
    http.delete(`${API_URL}/clients/1/blacklist`, () => {
      calls.blacklistRemoved += 1;
      state.isBlacklisted = false;
      state.blacklistReason = undefined;
      return new HttpResponse(null, { status: 200 });
    }),
    http.patch(`${API_URL}/clients/1`, async ({ request }) => {
      const body = (await request.json()) as { name: string; phone: string };
      calls.updated.push(body);
      state.name = body.name;
      state.phone = body.phone;
      return HttpResponse.json(asItem());
    }),
    http.delete(`${API_URL}/clients/1`, () => {
      calls.deleted += 1;
      state.deleted = true;
      return new HttpResponse(null, { status: 200 });
    }),
  );
  return { state, calls };
}

async function openCard(user: User) {
  renderWithProviders(<ClientsPage />);
  await user.click(await screen.findByText("Алия"));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("Дети:");
  return dialog;
}

/** Меню «⋮» в карточке клиента (у кнопки нет подписи — ищем по иконке). */
async function openMenu(user: User, dialog: HTMLElement) {
  const trigger = dialog
    .querySelector(".tabler-icon-dots-vertical")
    ?.closest("button");
  await user.click(trigger as HTMLElement);
}

describe("ClientsPage list", () => {
  it("shows clients and marks only the blacklisted one with «В ЧС»", async () => {
    mockClientsBackend({ isBlacklisted: true });
    renderWithProviders(<ClientsPage />);

    expect(await screen.findByText("Алия")).toBeInTheDocument();
    expect(screen.getByText("В ЧС")).toBeInTheDocument();
  });

  it("shows no «В ЧС» badge for a regular client", async () => {
    mockClientsBackend();
    renderWithProviders(<ClientsPage />);

    await screen.findByText("Алия");

    expect(screen.queryByText("В ЧС")).not.toBeInTheDocument();
  });

  it("searches only for 2+ characters and opens the card of the chosen client", async () => {
    const { calls } = mockClientsBackend();
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);
    await screen.findByText("Алия");
    const input = screen.getByPlaceholderText("Поиск клиента...");

    await user.type(input, "А");
    await new Promise((resolve) => setTimeout(resolve, 600)); // дебаунс 400 мс
    expect(calls.searchQueries).toEqual([]);

    await user.type(input, "л");
    await waitFor(() => expect(calls.searchQueries.at(-1)).toBe("Ал"), {
      timeout: 3000,
    });
    const option = await waitFor(
      () => {
        const found = screen
          .getAllByText("Алия")
          .find((el) => el.closest("[data-combobox-option]"));
        expect(found).toBeDefined();
        return found as HTMLElement;
      },
      { timeout: 3000 },
    );
    await user.click(option);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("says nothing was found for an unknown query", async () => {
    mockClientsBackend();
    server.use(
      http.get(`${API_URL}/clients/search`, () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);
    await screen.findByText("Алия");

    await user.type(screen.getByPlaceholderText("Поиск клиента..."), "яяя");

    expect(
      await screen.findByText("Ничего не найдено", undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});

describe("blacklist", () => {
  it("adds a client to the blacklist with a reason and updates the list", async () => {
    const { calls } = mockClientsBackend();
    const user = userEvent.setup();
    const card = await openCard(user);
    expect(screen.queryByText("В ЧС")).not.toBeInTheDocument();

    await openMenu(user, card);
    await user.click(await screen.findByText("Добавить в ЧС"));
    const reasonDialog = await screen.findByRole("dialog", {
      name: /Добавление в черный список/,
    });
    await user.type(
      within(reasonDialog).getByLabelText(/Причина/),
      "не вернула костюм",
    );
    await user.click(
      within(reasonDialog).getByRole("button", { name: "В черный список" }),
    );

    await waitFor(() =>
      expect(calls.blacklistAdded).toEqual([
        { blacklistReason: "не вернула костюм" },
      ]),
    );
    // список клиентов перезапрошен после мутации
    expect(await screen.findByText("В ЧС")).toBeInTheDocument();
  });

  it("allows adding to the blacklist without a reason (current behaviour)", async () => {
    const { calls } = mockClientsBackend();
    const user = userEvent.setup();
    const card = await openCard(user);

    await openMenu(user, card);
    await user.click(await screen.findByText("Добавить в ЧС"));
    const reasonDialog = await screen.findByRole("dialog", {
      name: /Добавление в черный список/,
    });
    await user.click(
      within(reasonDialog).getByRole("button", { name: "В черный список" }),
    );

    await waitFor(() => expect(calls.blacklistAdded).toHaveLength(1));
    expect(calls.blacklistAdded[0]).toEqual({ blacklistReason: "" });
  });

  it("removes a client from the blacklist and drops the badge and the reason", async () => {
    const { calls } = mockClientsBackend({
      isBlacklisted: true,
      blacklistReason: "порвали костюм",
    });
    const user = userEvent.setup();
    const card = await openCard(user);
    expect(
      await within(card).findByText("В черном списке"),
    ).toBeInTheDocument();
    expect(within(card).getByText("порвали костюм")).toBeInTheDocument();

    await openMenu(user, card);
    await user.click(await screen.findByText("Убрать из ЧС"));

    await waitFor(() => expect(calls.blacklistRemoved).toBe(1));
    await waitFor(() =>
      expect(within(card).queryByText("В черном списке")).not.toBeInTheDocument(),
    );
    expect(within(card).queryByText("порвали костюм")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("В ЧС")).not.toBeInTheDocument(),
    );
  });

  it("shows the backend error once when the client does not exist (404)", async () => {
    const showSpy = vi.spyOn(notifications, "show");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockClientsBackend();
    server.use(
      http.post(`${API_URL}/clients/1/blacklist`, () =>
        HttpResponse.json(
          { statusCode: 404, message: "Клиент с ID 1 не найден" },
          { status: 404 },
        ),
      ),
    );
    // глобальный toast ошибок мутаций живёт в queryClient приложения
    const queryClient = createTestQueryClient();
    queryClient.getMutationCache().config.onError =
      appQueryClient.getMutationCache().config.onError;
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />, queryClient);
    await user.click(await screen.findByText("Алия"));
    const card = await screen.findByRole("dialog");
    await within(card).findByText("Дети:");

    await openMenu(user, card);
    await user.click(await screen.findByText("Добавить в ЧС"));
    const reasonDialog = await screen.findByRole("dialog", {
      name: /Добавление в черный список/,
    });
    await user.click(
      within(reasonDialog).getByRole("button", { name: "В черный список" }),
    );

    await waitFor(() =>
      expect(showSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Клиент с ID 1 не найден" }),
      ),
    );
    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("В ЧС")).not.toBeInTheDocument();
  });
});

describe("client card", () => {
  it("saves the edited name and phone and refreshes the list", async () => {
    const { calls } = mockClientsBackend();
    const user = userEvent.setup();
    const card = await openCard(user);

    await openMenu(user, card);
    await user.click(await screen.findByText("Редактировать"));
    const name = within(card).getByLabelText("Имя и Фамилия");
    await user.clear(name);
    await user.type(name, "Алия Серикова");
    await user.click(within(card).getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(calls.updated).toEqual([
        { name: "Алия Серикова", phone: "+77071234567" },
      ]),
    );
    expect(await screen.findAllByText("Алия Серикова")).not.toHaveLength(0);
  });

  it("does not send an invalid name and keeps the form open", async () => {
    const { calls } = mockClientsBackend();
    const user = userEvent.setup();
    const card = await openCard(user);

    await openMenu(user, card);
    await user.click(await screen.findByText("Редактировать"));
    const name = within(card).getByLabelText("Имя и Фамилия");
    await user.clear(name);
    await user.type(name, "А1");
    await user.click(within(card).getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(within(card).getByLabelText("Имя и Фамилия")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(calls.updated).toHaveLength(0);
  });

  it("deletes a client only after confirmation", async () => {
    const { calls } = mockClientsBackend();
    const user = userEvent.setup();
    const card = await openCard(user);

    await openMenu(user, card);
    await user.click(await screen.findByText("Удалить клиента"));
    const confirm = await screen.findByRole("dialog", { name: "Удаление клиента" });
    expect(calls.deleted).toBe(0);

    await user.click(within(confirm).getByRole("button", { name: "Отмена" }));
    expect(calls.deleted).toBe(0); // отмена ничего не отправляет

    await openMenu(user, card);
    await user.click(await screen.findByText("Удалить клиента"));
    const again = await screen.findByRole("dialog", { name: "Удаление клиента" });
    await user.click(
      within(again).getByRole("button", { name: "Удалить навсегда" }),
    );

    await waitFor(() => expect(calls.deleted).toBe(1));
    await waitFor(() =>
      expect(screen.queryByText("Алия")).not.toBeInTheDocument(),
    );
  });
});
