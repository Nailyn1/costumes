import { Title, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState } from "react";
import { ClientSelector } from "src/features/clients-children/components/clients/clientSelector";
import { OrderList } from "src/features/visits/components/OrderList";
import { VisitSelector } from "src/features/visits/components/VisitSelector";
import { VisitSummaryPanel } from "src/features/visits/components/VisitSummaryPanel";
import type { BookingFormValues } from "src/features/visits/types/visitTypes";

export function CreateBookingPage() {
  const [formKey, setFormKey] = useState(0);
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
      orders: [
        {
          childId: null,
          costumeId: null,
          rentPrice: undefined,
          prepaymentAmount: undefined,
          notes: "",
        },
      ],
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
          !value ? "Введите сумму предоплаты" : null,
      },
    },
  });

  const handleReset = () => {
    form.reset();
    setFormKey((prev) => prev + 1); // Меняем ключ -> все селекторы перерисуются с нуля
  };

  return (
    <Stack key={formKey} gap="xl" pb={100}>
      <Title order={2}>Создание брони</Title>

      <ClientSelector {...form.getInputProps("clientId")} />

      <VisitSelector
        values={form.values}
        errors={form.errors}
        onChange={(newValues) => form.setValues(newValues)}
      />

      <OrderList form={form} clientId={Number(form.values.clientId) || null} />

      <VisitSummaryPanel form={form} onSuccessfullyCreated={handleReset} />
    </Stack>
  );
}
