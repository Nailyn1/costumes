import type { visitIssuedRepsonseDto } from "@costumes/shared";
import {
  Paper,
  Group,
  Badge,
  Stack,
  Box,
  Text,
  Divider,
  Button,
} from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { WhatsAppButton } from "src/components/WhatsAppButton";
import { formatPhoneNumber, formatStayDates } from "src/utills/formatters";

export type VisitIssuedItemDto = visitIssuedRepsonseDto["items"][number];

interface ReturnCardProps {
  visit: VisitIssuedItemDto;
  onClick: () => void;
}

export function ReturnCard({ visit, onClick }: ReturnCardProps) {
  return (
    <Paper withBorder p="md" radius="md" shadow="sm">
      <Stack gap="xs">
        <Group justify="space-between">
          <Badge variant="filled" color="blue" size="lg">
            #{visit.visitCode}
          </Badge>
        </Group>

        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Box>
            <Text fw={700} size="lg">
              {visit.clientName}
            </Text>
            <Text size="md" c="dimmed">
              {formatPhoneNumber(visit.clientPhone)} | {visit.childrenNames}
            </Text>
          </Box>

          <WhatsAppButton
            phone={visit.clientPhone}
            iconOnly
            size="xl"
            color="green"
            variant="light"
            radius="md"
            iconSize={24}
          />
        </Group>

        <Group gap="xs" wrap="nowrap" align="flex-start">
          <Text size="lg" fw={500} c="dimmed" style={{ flex: 1 }}>
            Костюмы: {visit.costumesNames}
          </Text>
        </Group>

        <Divider variant="dashed" />

        <Group justify="space-between" align="center">
          <Text size="lg" c="dimmed">
            {formatStayDates(visit.startDateTime, visit.endDateTime)}
          </Text>

          <Button
            size="md"
            variant="light"
            rightSection={<IconArrowRight size={14} />}
            onClick={onClick}
          >
            Оформить
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
