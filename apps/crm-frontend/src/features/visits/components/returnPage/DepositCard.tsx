import {
  Paper,
  Group,
  Badge,
  Stack,
  Box,
  Text,
  Button,
  Divider,
} from "@mantine/core";
import { IconCash, IconFileDescription, IconCheck } from "@tabler/icons-react";
import { formatPhoneNumber, formatStayDates } from "src/utills/formatters";
import type { UnreturnedDepositItem } from "../../types/visitTypes";

interface DepositCardProps {
  visit: UnreturnedDepositItem;
  onMarkReturned: () => void;
}

export function DepositCard({ visit, onMarkReturned }: DepositCardProps) {
  const isCash = visit.deposit.type === "cash";

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Badge variant="filled" color="orange" size="lg">
            #{visit.visitCode}
          </Badge>
          <Group gap={4}>
            {isCash ? (
              <IconCash size={16} color="green" />
            ) : (
              <IconFileDescription size={16} color="blue" />
            )}
            <Text fw={700} c={isCash ? "green" : "blue"}>
              {isCash ? `${visit.deposit.amount} ₽` : "Документ"}
            </Text>
          </Group>
        </Group>

        <Box>
          <Text fw={700} size="lg">
            {visit.clientName}
          </Text>
          <Text size="md" c="dimmed">
            {formatPhoneNumber(visit.clientPhone)}
          </Text>
        </Box>

        <Text size="md" c="dimmed">
          Костюм: {visit.costumeNames}
        </Text>

        <Divider variant="dashed" />

        <Group justify="space-between" align="center">
          <Text size="md" c="dimmed">
            Дата аренды:{" "}
            {formatStayDates(visit.startDateTime, visit.endDateTime)}
          </Text>
          <Button
            variant="light"
            color="green"
            size="compact-lg"
            leftSection={<IconCheck size={14} />}
            onClick={onMarkReturned}
            ml="auto"
          >
            Отдать залог
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
