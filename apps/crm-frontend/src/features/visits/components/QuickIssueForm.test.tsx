import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { QuickIssueVisitRequestDto } from "@costumes/shared";
import {
  createTestQueryClient,
  renderWithProviders,
} from "../../../../test/render";
import { API_URL, server } from "../../../../test/server";
import { clientKeys } from "src/features/clients-children/hooks/useClients";
import { costumesKeys } from "src/features/costumes/hooks/useCostumes";
import { useAuthStore } from "src/stores/auth.store";
import type { VisitOrder } from "../types/visitTypes";
import type { OrderSelectionFieldsProps } from "./OrderSelectionFields";
import { QuickIssueForm } from "./QuickIssueForm";

// Проверяем управление черновиком; сами поисковые селекторы имеют отдельные тесты.
vi.mock("./OrderSelectionFields", () => ({
  OrderSelectionFields: ({
    value,
    onChange,
    errors,
  }: OrderSelectionFieldsProps) => (
    <div>
      <label>
        Ребёнок
        <input
          value={value.childId ?? ""}
          onChange={(event) =>
            onChange({ ...value, childId: Number(event.target.value) || null })
          }
        />
      </label>
      <label>
        Костюм
        <input
          value={value.costumeId ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              costumeId: Number(event.target.value) || null,
            })
          }
        />
      </label>
      <label>
        Аренда
        <input
          value={value.rentPrice}
          onChange={(event) =>
            onChange({
              ...value,
              rentPrice:
                event.target.value === "" ? "" : Number(event.target.value),
            })
          }
        />
      </label>
      <span>{errors?.childId}</span>
      <span>{errors?.costumeId}</span>
      <span>{errors?.rentPrice}</span>
    </div>
  ),
}));

const order: VisitOrder = {
  childId: 10,
  costumeId: 20,
  rentPrice: 2200,
  notes: "",
  prepaymentAmount: undefined,
};
const blank: VisitOrder = {
  childId: null,
  costumeId: null,
  rentPrice: undefined,
  notes: "",
  prepaymentAmount: undefined,
};

function Harness({
  initialOrders = [order],
}: {
  initialOrders?: VisitOrder[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [notes, setNotes] = useState("");
  return (
    <QuickIssueForm
      active
      clientId="2"
      orders={orders}
      notes={notes}
      prepaymentTotal={0}
      onOrdersChange={setOrders}
      onNotesChange={setNotes}
      onPendingChange={() => {}}
      onStartAnother={() => {}}
      onClientError={() => {}}
    />
  );
}

function renderForm(initialOrders = [order], whatsappConfirmed = true) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryDefaults(costumesKeys.detail(20), { gcTime: Infinity });
  queryClient.setQueryData(clientKeys.formState("2"), {
    id: "2",
    name: "Алия",
    phone: "+77071234567",
    isBlacklisted: false,
    whatsappConfirmed,
    children: [{ childId: 10, name: "Маша" }],
  });
  queryClient.setQueryData(costumesKeys.detail(20), {
    costumeId: 20,
    name: "Эльза",
    inventoryCode: "C-0020",
  });
  return renderWithProviders(
    <Harness initialOrders={initialOrders} />,
    queryClient,
  );
}

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 9, 24, 15, 0));
  useAuthStore
    .getState()
    .setAuth({
      accessToken: "test-token",
      user: { login: "operator-a", name: "Оператор" },
    });
  server.use(
    http.post(`${API_URL}/visits/preview-code`, () =>
      HttpResponse.json("1234", { status: 201 }),
    ),
  );
});

afterEach(() => {
  window.sessionStorage.clear();
  useAuthStore.setState({ user: null, accessToken: null, isAuth: false });
  vi.useRealTimers();
});

async function openReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Проверить и выдать" }));
  return screen.findByRole("dialog", { name: /Выдать сейчас/ });
}

describe("QuickIssueForm", () => {
  it("explains an empty second order and does not request a code until it is fixed", async () => {
    const preview = vi.fn();
    server.use(
      http.post(`${API_URL}/visits/preview-code`, () => {
        preview();
        return HttpResponse.json("1234", { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderForm([order, blank]);

    await user.click(
      screen.getByRole("button", { name: "Проверить и выдать" }),
    );
    expect(
      await screen.findByText("Заказ №2: Выберите ребёнка"),
    ).toBeInTheDocument();
    expect(screen.getByText("Заказ №2: Выберите костюм")).toBeInTheDocument();
    expect(
      screen.getByText(/Заказ №2: Укажите целую сумму аренды/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();

    await user.type(screen.getAllByLabelText("Ребёнок")[1], "10");
    await user.type(screen.getAllByLabelText("Костюм")[1], "21");
    await user.type(screen.getAllByLabelText("Аренда")[1], "3000");
    const modal = await openReview(user);
    expect(within(modal).getByLabelText("Получено сейчас")).toHaveValue(
      "5 200 ₸",
    );
    expect(preview).toHaveBeenCalledTimes(1);
  });

  it("defaults payment to total rent and keeps manual zero, deposit and notes across reopening", async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.queryByLabelText("Дата выдачи")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Время выдачи")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Получено сейчас")).not.toBeInTheDocument();
    let modal = await openReview(user);
    expect(within(modal).getByLabelText("Получено сейчас")).toHaveValue(
      "2 200 ₸",
    );
    expect(within(modal).getByText("WhatsApp есть")).toBeInTheDocument();
    expect(within(modal).queryByText(/Бирка/)).not.toBeInTheDocument();
    expect(within(modal).getByText("Код: C-0020")).toBeInTheDocument();
    await user.clear(within(modal).getByLabelText("Получено сейчас"));
    await user.type(within(modal).getByLabelText("Получено сейчас"), "0");
    await user.click(within(modal).getByText("Нал"));
    await user.type(within(modal).getByLabelText("Сумма залога"), "5000");
    await user.type(
      within(modal).getByLabelText("Комментарий к выдаче"),
      "Доплатят завтра",
    );
    await user.click(within(modal).getByRole("button", { name: "Назад" }));
    await user.clear(screen.getByLabelText("Аренда"));
    await user.type(screen.getByLabelText("Аренда"), "3000");
    modal = await openReview(user);
    expect(within(modal).getByLabelText("Получено сейчас")).toHaveValue("0 ₸");
    expect(within(modal).getByLabelText("Сумма залога")).toHaveValue("5 000 ₸");
    expect(within(modal).getByLabelText("Комментарий к выдаче")).toHaveValue(
      "Доплатят завтра",
    );
    expect(
      within(modal).getByText("После выдачи останется долг: 3000 ₸"),
    ).toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "Подставить всю сумму" })).not.toBeInTheDocument();
  });

  it.each(["absent", "unknown"])(
    "allows issuing when WhatsApp is %s and replays the identical command after a lost result",
    async (status) => {
      const requests: QuickIssueVisitRequestDto[] = [];
      server.use(
        http.get(`${API_URL}/clients/2/whatsapp-availability`, () =>
          HttpResponse.json({ status }),
        ),
        http.post(`${API_URL}/visits/quick-issue`, async ({ request }) => {
          requests.push((await request.json()) as QuickIssueVisitRequestDto);
          return HttpResponse.json(
            { statusCode: 500, message: "Временная ошибка" },
            { status: 500 },
          );
        }),
      );
      const user = userEvent.setup();
      renderForm([order], false);
      const modal = await openReview(user);
      await within(modal).findByText(
        status === "absent"
          ? /WhatsApp не найден/
          : /Не удалось проверить WhatsApp/,
      );
      await user.click(
        within(modal).getByRole("button", { name: "Выдать костюмы" }),
      );
      await screen.findByText("Выдача ещё не подтверждена");
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Повторить выдачу" }),
        ).toBeEnabled(),
      );
      await user.click(
        screen.getByRole("button", { name: "Повторить выдачу" }),
      );
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]).toEqual(requests[0]);
      expect(requests[0]).toMatchObject({
        additionalPayment: 2200,
        deposit: { type: "document" },
        orders: [{ childId: 10, costumeId: 20, rentPrice: 2200 }],
      });
    },
  );

  it("rejects an empty received amount inside the modal without sending an issue command", async () => {
    const issue = vi.fn();
    server.use(
      http.post(`${API_URL}/visits/quick-issue`, () => {
        issue();
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderForm();
    const modal = await openReview(user);
    await user.clear(within(modal).getByLabelText("Получено сейчас"));
    await user.click(
      within(modal).getByRole("button", { name: "Выдать костюмы" }),
    );
    expect(await within(modal).findByRole("alert")).toHaveTextContent(
      "Укажите целую полученную сумму не меньше 0 ₸",
    );
    expect(issue).not.toHaveBeenCalled();
  });

  it.each([0, 1000, 3000])(
    "sends the actual manually entered payment %i separately from the deposit",
    async (payment) => {
      let submitted: QuickIssueVisitRequestDto | null = null;
      server.use(
        http.post(`${API_URL}/visits/quick-issue`, async ({ request }) => {
          submitted = (await request.json()) as QuickIssueVisitRequestDto;
          return HttpResponse.json(
            { statusCode: 400, message: "Проверка тестового запроса" },
            { status: 400 },
          );
        }),
      );
      const user = userEvent.setup();
      renderForm();
      const modal = await openReview(user);
      await user.clear(within(modal).getByLabelText("Получено сейчас"));
      await user.type(
        within(modal).getByLabelText("Получено сейчас"),
        String(payment),
      );
      await user.click(within(modal).getByText("Нал"));
      await user.type(within(modal).getByLabelText("Сумма залога"), "5000");
      await user.click(
        within(modal).getByRole("button", { name: "Выдать костюмы" }),
      );
      await waitFor(() =>
        expect(submitted).toMatchObject({
          additionalPayment: payment,
          deposit: { type: "cash", amount: 5000 },
        }),
      );
      const reopened = await screen.findByRole("dialog", {
        name: /Выдать сейчас/,
      });
      expect(within(reopened).getByLabelText("Получено сейчас")).toHaveValue(
        `${payment.toLocaleString("ru-RU").replaceAll("\u00a0", " ")} ₸`,
      );
    },
  );
});
