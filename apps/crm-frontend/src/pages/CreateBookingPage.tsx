import {
  Title,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  SimpleGrid,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { ClientSelector } from "src/features/clients-children/components/clients/clientSelector";
import { OrderList } from "src/features/visits/components/OrderList";
import { VisitSelector } from "src/features/visits/components/VisitSelector";
import type {
  VisitData,
  VisitOrder,
} from "src/features/visits/types/visitDateTypes";

export interface BookingFormValues extends VisitData {
  clientId: string | null;
  orders: VisitOrder[];
}

export function CreateBookingPage() {
  const form = useForm<BookingFormValues>({
    initialValues: {
      clientId: null,
      startDateTime: null,
      endDateTime: null,
      issueTimeFrom: "18:30",
      issueTimeTo: "19:30",
      returnTimeUntil: "18:00",
      orders: [
        {
          childId: null,
          costumeId: null,
          rentPrice: 0,
          prepaymentAmount: 0,
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
      },
    },
  });

  const totalRent = form.values.orders.reduce(
    (sum, order) => sum + (Number(order.rentPrice) || 0),
    0,
  );

  const totalPrepayment = form.values.orders.reduce(
    (sum, order) => sum + (Number(order.prepaymentAmount) || 0),
    0,
  );

  console.log("Data", form.values.startDateTime, form.values.issueTimeFrom);
  return (
    <Stack gap="xl" pb={100}>
      <Title order={2}>Создание брони</Title>

      {/* 1. Выбор клиента */}
      <ClientSelector {...form.getInputProps("clientId")} />

      {/* 2. Параметры визита (даты/время) */}
      <VisitSelector
        values={form.values}
        errors={form.errors}
        onChange={(newValues) => form.setValues(newValues)}
      />

      <OrderList form={form} clientId={Number(form.values.clientId) || null} />

      {/* 4. Итоговая панель */}
      <Paper withBorder p="xl" radius="md" shadow="md" pos="sticky" bottom={20}>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={700} size="lg">
              Итого по визиту:
            </Text>
            <Stack gap={0} align="flex-end">
              <Text size="xl" fw={800} c="blue">
                {totalRent.toLocaleString()} ₸
              </Text>
              <Text size="xs" c="dimmed">
                Всего предоплаты: {totalPrepayment.toLocaleString()} ₸
              </Text>
            </Stack>
          </Group>

          <SimpleGrid cols={2} mt="md">
            <Button
              size="lg"
              variant="light"
              color="gray"
              onClick={() => console.log(form.errors)}
            >
              Проверить
            </Button>
            <Button size="lg" color="blue" type="submit">
              Подтвердить и создать
            </Button>
          </SimpleGrid>
        </Stack>
      </Paper>
    </Stack>
  );
}
