import { Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";
import type { PaginatedUnsettledVisitBalancesResponseDto } from "@costumes/shared";
import { formatPhoneNumber } from "src/utils/formatters";

export type UnsettledBalanceItem = PaginatedUnsettledVisitBalancesResponseDto["items"][number];

interface Props {
  visit: UnsettledBalanceItem;
  onSelect: () => void;
}

export function UnsettledBalanceCard({ visit, onSelect }: Props) {
  const isDebt = visit.balance.debt > 0;
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Badge size="lg" color={isDebt ? "orange" : "red"}>#{visit.visitCode}</Badge>
          <Text fw={700} c={isDebt ? "orange.9" : "red.8"}>
            {isDebt ? `Долг: ${visit.balance.debt} ₸` : `К возврату: ${visit.balance.refundDue} ₸`}
          </Text>
        </Group>
        <Text fw={700}>{visit.clientName}</Text>
        <Text c="dimmed">{formatPhoneNumber(visit.clientPhone)}</Text>
        <Button variant="light" fullWidth onClick={onSelect}>
          Открыть расчёт
        </Button>
      </Stack>
    </Paper>
  );
}
