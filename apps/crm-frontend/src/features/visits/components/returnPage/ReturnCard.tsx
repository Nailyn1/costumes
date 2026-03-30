import type { visitIssuedRepsonseDto } from "@costumes/shared";
import {
  Paper,
  Group,
  Badge,
  Stack,
  Box,
  Text,
  Divider,
  ActionIcon,
} from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { formatPhoneNumber, formatStayDates } from "src/utills/formatters";

export type VisitIssuedItemDto = visitIssuedRepsonseDto["items"][number];

interface ReturnCardProps {
  visit: VisitIssuedItemDto;
  onClick: () => void;
}

export function ReturnCard({ visit, onClick }: ReturnCardProps) {
  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <Stack gap="xs">
        <Group justify="space-between">
          <Badge variant="filled" color="blue" size="lg">
            #{visit.visitCode}
          </Badge>
        </Group>

        <Box>
          <Text fw={700} size="lg">
            {visit.clientName}
          </Text>
          <Text size="md" c="dimmed">
            {formatPhoneNumber(visit.clientPhone)} | {visit.childrenNames}
          </Text>
        </Box>

        <Group gap="xs" wrap="nowrap" align="flex-start">
          <Text size="lg" fw={500} c="dimmed" style={{ flex: 1 }}>
            Костюмы: {visit.costumesNames}
          </Text>
        </Group>

        <Divider variant="dashed" />

        <Group justify="space-between">
          <Text size="lg" c="dimmed">
            {formatStayDates(visit.startDateTime, visit.endDateTime)}
          </Text>
          <ActionIcon variant="subtle" color="blue">
            <IconArrowRight size={18} />
          </ActionIcon>
        </Group>
      </Stack>
    </Paper>
  );
}
