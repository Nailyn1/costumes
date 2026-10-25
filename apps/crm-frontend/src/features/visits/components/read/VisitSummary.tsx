import { Badge, Group, Paper, Stack, Text } from "@mantine/core";
import {
  IconCash,
  IconCircleOff,
  IconFileText,
  IconHanger,
  IconPhone,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { VisitReadDetailDto } from "@costumes/shared";
import { formatPhoneNumber, formatStayDates } from "src/utils/formatters";
import {
  formatVisitMoney,
  visitStatusLabels,
} from "../../utils/visitReadFormatters";

export function VisitSummary({
  visit,
  actions,
}: {
  visit: VisitReadDetailDto;
  actions: ReactNode;
}) {
  const received = visit.moneyOperations
    .filter(
      (operation) =>
        !operation.voidedAt && operation.kind !== "customer_refund",
    )
    .reduce((sum, operation) => sum + operation.amount, 0);
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Group gap={6}>
            <IconPhone size={16} />
            <Text size="sm">{formatPhoneNumber(visit.client.phone)}</Text>
          </Group>
          <Badge variant="light" w="fit-content">
            {visitStatusLabels[visit.status]}
          </Badge>
        </Stack>
        <Group align="flex-start" gap="sm">
          {visit.deposits.map((deposit) => {
            const Icon =
              deposit.type === "cash"
                ? IconCash
                : deposit.type === "document"
                  ? IconFileText
                  : IconCircleOff;
            const label =
              deposit.type === "cash"
                ? `Деньги · ${formatVisitMoney(deposit.amount ?? 0)}`
                : deposit.type === "document"
                  ? "Документ"
                  : "Без залога";
            return (
              <Stack key={deposit.id} gap={2} align="center" maw={130}>
                <Icon size={24} aria-label={label} />
                <Text size="xs" ta="center">
                  {label}
                </Text>
                {deposit.type !== "none" && (
                  <Text size="xs" c={deposit.returned ? "green.8" : "orange.8"}>
                    {deposit.returned ? "Вернули" : "Удерживается"}
                  </Text>
                )}
              </Stack>
            );
          })}
          {actions}
        </Group>
      </Group>
      <Paper withBorder p="sm" radius="md" bg="blue.0">
        <Stack gap={3}>
          <Text fw={600}>
            {formatStayDates(visit.startDateTime, visit.endDateTime)}
          </Text>
          <Text size="sm">
            Выдача в {visit.issueTimeFrom}–{visit.issueTimeTo}
          </Text>
          <Text size="sm">Возврат до {visit.returnTimeUntil}</Text>
        </Stack>
      </Paper>
      <Stack gap={4}>
        <Group gap="md">
          <Text size="sm">
            Аренда: {formatVisitMoney(visit.totals.totalRent)}
          </Text>
          <Text size="sm">
            Предоплата: {formatVisitMoney(visit.totals.totalPrepayment)}
          </Text>
          <Text size="sm">
            Доплата: {formatVisitMoney(visit.totals.totalRemaining)}
          </Text>
        </Group>
        <Text size="sm" fw={600}>
          Всего получено:{" "}
          {formatVisitMoney(visit.totals.totalPrepayment + received)}
        </Text>
        {visit.balance && (
          <Group gap="md">
            {visit.balance.totalRefunded > 0 && (
              <Text size="sm">
                Возвращено клиенту:{" "}
                {formatVisitMoney(visit.balance.totalRefunded)}
              </Text>
            )}
            {visit.balance.debt > 0 && (
              <Text size="sm" c="orange.8">
                Долг: {formatVisitMoney(visit.balance.debt)}
              </Text>
            )}
            {visit.balance.refundDue > 0 && (
              <Text size="sm" c="red.8">
                К возврату: {formatVisitMoney(visit.balance.refundDue)}
              </Text>
            )}
          </Group>
        )}
      </Stack>
      {visit.notes && (
        <Text size="sm" c="dimmed">
          {visit.notes}
        </Text>
      )}
    </Stack>
  );
}

const orderStatuses = {
  reserved: "Забронирован",
  issued: "В прокате",
  returned: "Возвращён",
  cancelled: "Отменён",
} as const;

export function VisitCostumeCard({
  order,
}: {
  order: VisitReadDetailDto["orders"][number];
}) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Stack gap={5}>
        <Group gap={6} wrap="nowrap" align="flex-start">
          <IconHanger size={18} />
          <Text fw={600}>
            {order.costumeName} ({order.inventoryCode})
          </Text>
        </Group>
        <Badge variant="outline" w="fit-content" size="sm">
          {orderStatuses[order.status]}
        </Badge>
        <Text size="sm">Ребёнок: {order.childName}</Text>
        <Text size="sm" fw={600}>
          Аренда {formatVisitMoney(order.rentPrice)} · оплачено по заказу{" "}
          {formatVisitMoney(order.prepaymentAmount + (order.finalPayment ?? 0))}{" "}
          (пред. {formatVisitMoney(order.prepaymentAmount)})
        </Text>
        {order.notes && (
          <Text size="sm" c="dimmed">
            {order.notes}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
