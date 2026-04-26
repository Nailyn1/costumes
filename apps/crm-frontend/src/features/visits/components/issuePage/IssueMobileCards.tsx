import {
  Stack,
  Paper,
  Group,
  Badge,
  Text,
  Box,
  Divider,
  Button,
} from "@mantine/core";
import { IconUser, IconShirt, IconArrowRight } from "@tabler/icons-react";
import type { IssueListProps } from "../../types/visitTypes";
import { formatPhoneNumber } from "src/utills/formatters";
import { WhatsAppButton } from "src/components/WhatsAppButton";

function MobileCard({
  visit,
  onOpenVisit,
}: {
  visit: IssueListProps["items"][number];
  onOpenVisit: IssueListProps["onOpenVisit"];
}) {
  return (
    <Paper withBorder p="md" radius="md" shadow="sm">
      <Stack gap="md">
        <Group justify="space-between">
          <Badge color="blue" variant="filled" size="lg">
            #{visit.visitCode}
          </Badge>
        </Group>

        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Box>
            <Text fw={700} size="lg">
              {visit.clientName}
            </Text>
            <Text size="lg" c="dimmed">
              {formatPhoneNumber(visit.clientPhone)}
            </Text>
          </Box>

          <WhatsAppButton
            phone={visit.clientPhone}
            iconOnly
            size="xl"
            variant="light"
            radius="md"
            iconSize={24}
          />
        </Group>

        <Stack gap="sm" mt="xs">
          <Box>
            <Group gap={6} mb={2} wrap="nowrap">
              <IconUser size={16} color="gray" />
              <Text size="md" fw={500} c="dimmed">
                Дети
              </Text>
            </Group>
            <Text size="md" pl={22}>
              {" "}
              {visit.childrenNames}
            </Text>
          </Box>

          <Box>
            <Group gap={6} mb={2} wrap="nowrap">
              <IconShirt size={16} color="gray" />
              <Text size="md" fw={500} c="dimmed">
                Костюмы
              </Text>
            </Group>
            <Text size="md" fs="italic" pl={22}>
              {visit.costumesNames}
            </Text>
          </Box>
        </Stack>

        <Divider variant="dashed" size="sm" />

        <Group justify="flex-end">
          <Button
            size="md"
            variant="light"
            rightSection={<IconArrowRight size={14} />}
            onClick={() => onOpenVisit(visit)}
          >
            Оформить
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export function IssueMobileCards({ items, onOpenVisit }: IssueListProps) {
  return (
    <Stack gap="md">
      {items.map((visit) => (
        <MobileCard
          key={visit.visitId}
          visit={visit}
          onOpenVisit={onOpenVisit}
        />
      ))}
    </Stack>
  );
}
