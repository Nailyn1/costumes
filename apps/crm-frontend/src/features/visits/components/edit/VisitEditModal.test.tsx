import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import type {
  UpdateReservedVisitRequestDto,
  VisitReadDetailDto,
} from "@costumes/shared";
import { describe, expect, it, vi } from "vitest";
import { VisitEditModal } from "./VisitEditModal";
import type { OrderSelectionValue } from "../OrderSelectionFields";

vi.mock("../SmartDateInput", () => ({
  SmartDateInput: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string | null;
    onChange: (value: string | null) => void;
  }) => (
    <label>
      {label}
      <input
        value={value ?? ""}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  ),
}));

vi.mock("../OrderSelectionFields", () => ({
  OrderSelectionFields: ({
    value,
    onChange,
  }: {
    value: OrderSelectionValue;
    onChange: (next: OrderSelectionValue) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange({ ...value, notes: "Изменённое примечание позиции" })
      }
    >
      Выбрать костюм {value.costumeId}
    </button>
  ),
}));

const visit: VisitReadDetailDto = {
  id: 11,
  visitCode: "0011",
  status: "reserved",
  version: 1,
  client: { id: 21, name: "Айша", phone: "+77010000000" },
  startDateTime: "2026-10-22T10:00:00.000Z",
  endDateTime: "2026-10-23T10:00:00.000Z",
  issueTimeFrom: "10:00",
  issueTimeTo: "12:00",
  returnTimeUntil: "18:00",
  notes: "Исходное примечание",
  createdAt: "2026-10-20T10:00:00.000Z",
  orders: [
    {
      orderId: 31,
      childId: 41,
      childName: "Амина",
      costumeId: 51,
      costumeName: "Принцесса",
      inventoryCode: "C-0051",
      photoCount: 0,
      status: "reserved",
      tagStatus: "not_written",
      rentPrice: 10000,
      prepaymentAmount: 3000,
      notes: "Текущая заметка позиции",
    },
  ],
  moneyOperations: [],
  deposits: [],
  totals: { totalRent: 10000, totalPrepayment: 3000, totalRemaining: 7000 },
};

describe("VisitEditModal", () => {
  it("allows entering initial prepayment only for a new order and removing the unsaved row", async () => {
    const user = userEvent.setup();
    render(
      <MantineProvider>
        <VisitEditModal
          opened
          onClose={vi.fn()}
          visit={visit}
          isMobile={false}
          onSave={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(screen.getByLabelText("Предоплата")).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Добавить костюм" }));
    const field = screen.getAllByLabelText("Предоплата")[1];
    expect(field).not.toHaveAttribute("readonly");
    await user.clear(field);
    await user.type(field, "1500");
    expect(field).toHaveValue("₸ 1500");
    await user.click(screen.getByRole("button", { name: "Удалить" }));
    expect(screen.getAllByLabelText("Предоплата")).toHaveLength(1);
  });
  it("keeps notes and order data when the rental dates change", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const view = render(
      <MantineProvider>
        <VisitEditModal
          opened
          onClose={vi.fn()}
          visit={visit}
          isMobile={false}
          onSave={onSave}
        />
      </MantineProvider>,
    );

    await user.clear(screen.getByLabelText("Примечание к визиту"));
    await user.type(
      screen.getByLabelText("Примечание к визиту"),
      "Обновлённое примечание",
    );
    await user.clear(screen.getByLabelText("Дата выдачи"));
    await user.type(screen.getByLabelText("Дата выдачи"), "2026-10-24");
    await user.clear(screen.getByLabelText("Дата возврата"));
    await user.type(screen.getByLabelText("Дата возврата"), "2026-10-25");
    view.rerender(
      <MantineProvider>
        <VisitEditModal
          opened
          onClose={vi.fn()}
          visit={{ ...visit, version: 2, notes: "Обновлено другим чтением" }}
          isMobile={false}
          onSave={onSave}
        />
      </MantineProvider>,
    );
    expect(screen.getByLabelText("Примечание к визиту")).toHaveValue(
      "Обновлённое примечание",
    );
    expect(screen.getByLabelText("Дата выдачи")).toHaveValue("2026-10-24");
    await user.click(
      screen.getByRole("button", { name: "Сохранить изменения" }),
    );

    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        startDateTime: "2026-10-24",
        endDateTime: "2026-10-25",
        notes: "Обновлённое примечание",
        orders: [
          expect.objectContaining({
            orderId: 31,
            childId: 41,
            costumeId: 51,
            rentPrice: 10000,
            prepaymentAmount: 3000,
            notes: "Текущая заметка позиции",
          }),
        ],
      }),
    );
  });

  it("locks editing and offers replay for a persisted ambiguous command", async () => {
    const pendingRequest: UpdateReservedVisitRequestDto = {
      commandId: "a06d6c16-7f80-4507-b601-e03c2c13a54b",
      expectedVersion: 1,
      startDateTime: "2026-10-24",
      issueTimeFrom: "10:00",
      issueTimeTo: "12:00",
      endDateTime: "2026-10-25",
      returnTimeUntil: "18:00",
      orders: [{ orderId: 31, childId: 41, costumeId: 51, rentPrice: 10000 }],
    };
    const onRetryPending = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <MantineProvider>
        <VisitEditModal
          opened
          onClose={vi.fn()}
          visit={visit}
          isMobile={false}
          onSave={vi.fn()}
          onRetryPending={onRetryPending}
        />
      </MantineProvider>,
    );

    await user.clear(screen.getByLabelText("Примечание к визиту"));
    await user.type(
      screen.getByLabelText("Примечание к визиту"),
      "Мой черновик",
    );
    view.rerender(
      <MantineProvider>
        <VisitEditModal
          opened
          onClose={vi.fn()}
          visit={{ ...visit, version: 2 }}
          isMobile={false}
          onSave={vi.fn()}
          pendingRequest={pendingRequest}
          onRetryPending={onRetryPending}
        />
      </MantineProvider>,
    );

    expect(
      screen.getByText("Результат сохранения неизвестен"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Примечание к визиту")).toHaveValue(
      "Мой черновик",
    );
    expect(screen.getByLabelText("Примечание к визиту")).toBeDisabled();
    view.rerender(
      <MantineProvider>
        <VisitEditModal
          opened
          onClose={vi.fn()}
          visit={{ ...visit, version: 2 }}
          isMobile={false}
          onSave={vi.fn()}
          errorMessage="Команда отклонена"
          onRetryPending={onRetryPending}
        />
      </MantineProvider>,
    );
    expect(screen.getByLabelText("Примечание к визиту")).toHaveValue(
      "Мой черновик",
    );
    expect(screen.getByLabelText("Примечание к визиту")).toBeEnabled();

    view.rerender(
      <MantineProvider>
        <VisitEditModal
          opened
          onClose={vi.fn()}
          visit={{ ...visit, version: 2 }}
          isMobile={false}
          onSave={vi.fn()}
          pendingRequest={pendingRequest}
          onRetryPending={onRetryPending}
        />
      </MantineProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: "Повторить сохранение" }),
    );
    expect(onRetryPending).toHaveBeenCalledOnce();
  });
});
