import {
  Modal,
  Stack,
  Divider,
  Paper,
  Group,
  Box,
  Text,
  Badge,
  Alert,
  Button,
  Center,
  Loader,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconUser,
  IconPhone,
  IconInfoCircle,
  IconClock,
} from "@tabler/icons-react";
import { useIsAvailableCostume } from "../hooks/useCostumes";
import { formatPhoneNumber, formatStayDates } from "src/utills/formatters";

interface CostumeAvailabilityModalProps {
  opened: boolean;
  onClose: () => void;
  costumeId: number | null;
  isMobile: boolean;
}

export function CostumeAvailabilityModal({
  opened,
  onClose,
  costumeId,
  isMobile,
}: CostumeAvailabilityModalProps) {
  const { data, isLoading, isError } = useIsAvailableCostume(costumeId!);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconCalendarEvent size={20} color="var(--mantine-color-blue-6)" />
          <Text fw={700}>
            {data ? `${data.name} (${data.inventoryCode})` : "Загрузка..."}
          </Text>
        </Group>
      }
      fullScreen={isMobile}
      size="lg"
    >
      {isLoading && (
        <Center p="xl">
          <Loader />
        </Center>
      )}

      {isError && (
        <Alert color="red" title="Ошибка">
          Не удалось загрузить данные о занятости
        </Alert>
      )}

      {data && (
        <Stack gap="md">
          <Divider label="Периоды бронирования" labelPosition="center" />

          {data.periods && data.periods.length > 0 ? (
            data.periods.map((period, index) => (
              <Paper key={index} withBorder p="md" radius="md" bg="gray.0">
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Group gap={4} mb={2}>
                        <IconUser size={14} color="gray" />
                        <Text fw={700} size="lg">
                          {period.childName}
                        </Text>
                      </Group>
                      <Group gap={4}>
                        <IconPhone size={14} color="gray" />
                        <Text size="md" c="dimmed">
                          {formatPhoneNumber(period.clientPhone)}
                        </Text>
                      </Group>
                    </Box>
                    <Badge variant="outline" size="lg">
                      Визит: {period.visitCode}
                    </Badge>
                  </Group>

                  <Box
                    p="xs"
                    bg="blue.0"
                    style={{
                      borderRadius: "8px",
                      borderLeft: "4px solid var(--mantine-color-blue-6)",
                    }}
                  >
                    <Group gap={6} mb={6}>
                      <Text size="md" fw={700}>
                        Дата:
                      </Text>
                      <Text size="md" fw={600}>
                        {formatStayDates(
                          period.startDateTime,
                          period.endDateTime,
                        )}
                      </Text>
                    </Group>

                    <Group justify="space-between">
                      <Group gap={4} c="blue.8">
                        <IconClock size={14} />
                        <Text size="sm" fw={700}>
                          Выдача в {period.issueTimeFrom}
                        </Text>
                      </Group>

                      <Group gap={4} c="blue.8">
                        <IconClock size={14} />
                        <Text size="sm" fw={700}>
                          Возврат до {period.returnTimeUntil}
                        </Text>
                      </Group>
                    </Group>
                  </Box>
                </Stack>
              </Paper>
            ))
          ) : (
            <Alert
              icon={<IconInfoCircle size={18} />}
              color="gray"
              variant="light"
            >
              {data.noPeriodsMessage || "Костюм полностью свободен"}
            </Alert>
          )}

          <Button
            fullWidth
            variant="filled"
            color="blue"
            onClick={onClose}
            size="md"
            mt="md"
          >
            Понятно
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
