import { Fieldset, SegmentedControl, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useCallback, useState } from "react";
import { ClientSelector } from "src/features/clients-children/components/clients/clientSelector";
import { OrderList } from "./OrderList";
import { VisitSelector } from "./VisitSelector";
import { VisitSummaryPanel } from "./VisitSummaryPanel";
import { QuickIssueForm } from "./QuickIssueForm";
import { createEmptyOrder } from "../utils/bookingForm";
import { calcOrderTotals } from "../utils/orderTotals";
import type { BookingFormValues } from "../types/visitTypes";
import { useAuthStore } from "src/stores/auth.store";
import { getPendingQuickIssueRequest } from "../utils/quickIssueRequestStorage";

type CreationMode = "booking" | "quick";

export function CreateBookingForm() {
  const [formKey, setFormKey] = useState(0);
  const restoredRequest = getPendingQuickIssueRequest(
    useAuthStore.getState().user?.login ?? null,
  );
  const [mode, setMode] = useState<CreationMode>(restoredRequest ? "quick" : "booking");
  const [quickPending, setQuickPending] = useState(Boolean(restoredRequest));
  const onPendingChange = useCallback((pending: boolean) => {
    setQuickPending(pending);
    if (pending) setMode("quick");
  }, []);
  const form = useForm<BookingFormValues>({
    initialValues: {
      clientId: null,
      visitCode: "",
      startDateTime: null,
      endDateTime: null,
      issueTimeFrom: "18:30",
      issueTimeTo: "19:30",
      returnTimeUntil: "18:00",
      notes: "",
      orders: [createEmptyOrder()],
    },
    validate: {
      clientId: (value) => (!value ? "Выберите клиента" : null),
      startDateTime: (value) => (!value ? "Укажите дату выдачи" : null),
      endDateTime: (value) => (!value ? "Укажите дату возврата" : null),
      orders: {
        childId: (value) => (!value ? "Выберите ребенка" : null),
        costumeId: (value) => (!value ? "Выберите костюм" : null),
        rentPrice: (value) => (!value ? "Введите сумму аренды" : null),
        prepaymentAmount: (value) =>
          value === undefined || value === null
            ? "Введите сумму предоплаты"
            : null,
      },
    },
  });

  const handleReset = () => {
    form.reset();
    setMode("booking");
    setQuickPending(false);
    setFormKey((previous) => previous + 1);
  };

  const handleQuickNext = () => {
    form.reset();
    setMode("quick");
    setQuickPending(false);
    setFormKey((previous) => previous + 1);
  };

  const prepaymentTotal = calcOrderTotals(form.values.orders).prepayment;

  return (
    <Stack key={formKey} gap="xl" pb={100}>
      <Title order={2}>{mode === "booking" ? "Создание брони" : "Быстрая выдача"}</Title>
      <SegmentedControl
        value={mode}
        onChange={(value) => {
          if (!(quickPending && mode === "quick")) setMode(value as CreationMode);
        }}
        disabled={quickPending}
        data={[
          { label: "Бронь", value: "booking", disabled: quickPending },
          { label: "Выдать сейчас", value: "quick", disabled: quickPending },
        ]}
        fullWidth
      />
      <Fieldset variant="unstyled" disabled={quickPending && mode === "quick"}>
        <ClientSelector
          value={form.values.clientId}
        showWhatsappAvailability={mode === "booking"}
          onChange={(clientId) => {
            const changed = clientId !== form.values.clientId;
            form.setFieldValue("clientId", clientId);
            if (mode === "quick" && changed) {
              form.setFieldValue(
                "orders",
                form.values.orders.map((order) => ({ ...order, childId: null })),
              );
            }
          }}
          error={mode === "booking" ? form.errors.clientId : undefined}
        />
      </Fieldset>

      {mode === "booking" && (
        <Stack gap="xl">
          <VisitSelector
            values={form.values}
            errors={form.errors}
            onChange={(newValues) => {
              const isDateChanged =
                newValues.startDateTime !== form.values.startDateTime ||
                newValues.endDateTime !== form.values.endDateTime;

              if (isDateChanged) {
                form.setValues({
                  ...form.values,
                  ...newValues,
                  orders: [createEmptyOrder()],
                });
              } else {
                form.setValues({ ...form.values, ...newValues });
              }
            }}
          />
          <OrderList form={form} clientId={Number(form.values.clientId) || null} />
          <VisitSummaryPanel form={form} onSuccessfullyCreated={handleReset} />
        </Stack>
      )}

      <QuickIssueForm
        active={mode === "quick"}
        clientId={form.values.clientId}
        orders={form.values.orders}
        notes={form.values.notes}
        prepaymentTotal={prepaymentTotal}
        onOrdersChange={(orders) => form.setFieldValue("orders", orders)}
        onNotesChange={(notes) => form.setFieldValue("notes", notes)}
        onStartAnother={handleQuickNext}
        onPendingChange={onPendingChange}
      />
    </Stack>
  );
}
