import {
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { Link } from "react-router-dom";
import type { PaginatedVisitsResponseDto } from "@costumes/shared";
import { formatStayDates } from "src/utils/formatters";
import {
  formatVisitMoney,
  visitStatusLabels,
} from "../../../utils/visitReadFormatters";

export function VisitMobileCard({
  visit,
}: {
  visit: PaginatedVisitsResponseDto["items"][number];
}) {
  return (
    <Paper withBorder radius="md">
      <UnstyledButton
        component={Link}
        to={`/bookings/visits/${visit.id}`}
        display="block"
        w="100%"
        p="md"
        aria-label={`Открыть визит ${visit.visitCode}`}
      >
        <Stack gap={6}>
          <Group justify="space-between" align="flex-start">
            <Text fw={700}>
              {visit.client.name} · #{visit.visitCode}
            </Text>
            <Badge variant="light">{visitStatusLabels[visit.status]}</Badge>
          </Group>
          <Text size="sm">
            {formatStayDates(visit.startDateTime, visit.endDateTime)}
          </Text>
          <Text size="sm">{visit.costumesNames || "—"}</Text>
          <Text size="sm" c="dimmed">
            {visit.childrenNames || "—"}
          </Text>
          <Group gap="md">
            <Text size="sm">Аренда {formatVisitMoney(visit.totalRent)}</Text>
            <Text size="sm">
              Предоплата {formatVisitMoney(visit.totalPrepayment)}
            </Text>
          </Group>
        </Stack>
      </UnstyledButton>
    </Paper>
  );
}
