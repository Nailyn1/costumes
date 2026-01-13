import {
  Title,
  Text,
  Paper,
  Stack,
  Box,
  TextInput,
  Modal,
  Group,
  Divider,
  Loader,
  UnstyledButton,
  ThemeIcon,
  Alert,
  Button,
  Badge,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  IconSearch,
  IconCalendarEvent,
  IconShirt,
  IconInfoCircle,
  IconUser,
  IconPhone,
  IconChevronRight,
} from "@tabler/icons-react";
import { useState } from "react";
import classes from "./styles.module.css";
interface Costume {
  costumeId: number;
  name: string;
  inventoryCode: string;
}

interface Period {
  visitCode: string;
  childName: string;
  clientPhone: string;
  startDateTime: string;
  endDateTime: string;
}
interface CostumeAvailability extends Costume {
  periods: Period[];
  noPeriodsMessage?: string; // опционально, только когда периодов нет
}

// Имитация API ответов
const mockSearchResults = [
  {
    costumeId: 87,
    name: "Эльза",
    inventoryCode: "C-0128",
    display: "Эльза (C-0128)",
  },
  {
    costumeId: 214,
    name: "Эльза",
    inventoryCode: "C-0314",
    display: "Эльза (C-0314)",
  },
  {
    costumeId: 156,
    name: "Холодное сердце — Анна",
    inventoryCode: "C-0029",
    display: "Холодное сердце — Анна (C-0009)",
  },
];

const mockAvailability = {
  87: {
    costumeId: 87,
    name: "Эльза",
    inventoryCode: "C-0128",
    periods: [
      {
        visitCode: "1255",
        childName: "Жанна",
        clientPhone: "+77071234567",
        startDateTime: "2025-03-20T10:00:00+05:00",
        endDateTime: "2026-03-22T18:00:00+05:00",
      },
      {
        visitCode: "1236",
        childName: "Денис",
        clientPhone: "+77772233445",
        startDateTime: "2026-04-05T14:00:00+05:00",
        endDateTime: "2026-04-06T19:00:00+05:00",
      },
    ],
  },
  319: {
    costumeId: 319,
    name: "Пираты Карибского моря",
    inventoryCode: "C-0024",
    periods: [],
    noPeriodsMessage: "Периодов занятости нет",
  },
};

export function SchedulePage() {
  const [query, setQuery] = useState("");
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedCostume, setSelectedCostume] =
    useState<CostumeAvailability | null>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Форматирование даты
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSelectCostume = (costume: Costume) => {
    // В реальности тут был бы GET запрос по costumeId
    const data = mockAvailability[
      costume.costumeId as keyof typeof mockAvailability
    ] || {
      ...costume,
      periods: [],
      noPeriodsMessage: "Периодов занятости нет",
    };
    setSelectedCostume(data);
    open();
  };

  return (
    <Stack gap="lg">
      <Box>
        <Title order={isMobile ? 3 : 2}>Проверка занятости</Title>
        <Text size="sm" c="dimmed">
          Поиск свободных дат для костюма
        </Text>
      </Box>

      {/* ПОИСК */}
      <Paper withBorder p="md" radius="md" shadow="sm">
        <TextInput
          placeholder="Имя ребёнка / костюм / код визита"
          size="md"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={18} />}
          rightSection={query.length > 0 && <Loader size="xs" />}
        />
      </Paper>

      {/* РЕЗУЛЬТАТЫ ПОИСКА */}
      <Stack gap="xs">
        {query.length >= 2 ? (
          mockSearchResults.map((item) => (
            <UnstyledButton
              key={item.costumeId}
              onClick={() => handleSelectCostume(item)}
              className={classes.card}
              p="md"
            >
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon variant="light" color="blue" size="lg">
                    <IconShirt size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={600} size="md">
                      {item.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Код: {item.inventoryCode}
                    </Text>
                  </Box>
                </Group>
                <IconChevronRight size={18} color="gray" />
              </Group>
            </UnstyledButton>
          ))
        ) : query.length > 0 ? (
          <Text size="xs" c="dimmed" ta="center">
            Введите минимум 2 символа для поиска...
          </Text>
        ) : null}
      </Stack>

      {/* МОДАЛЬНОЕ ОКНО ЗАНЯТОСТИ */}
      <Modal
        opened={opened}
        onClose={close}
        title={
          <Group gap="xs">
            <IconCalendarEvent size={20} color="var(--mantine-color-blue-6)" />
            <Text fw={700}>
              {selectedCostume?.name} ({selectedCostume?.inventoryCode})
            </Text>
          </Group>
        }
        fullScreen={isMobile}
        size="lg"
      >
        <Stack gap="md">
          <Divider label="Периоды бронирования" labelPosition="center" />

          {/* Проверка: есть ли костюм и есть ли у него элементы в массиве periods */}
          {selectedCostume?.periods && selectedCostume.periods.length > 0 ? (
            selectedCostume.periods.map((period, index) => (
              <Paper key={index} withBorder p="md" radius="md" bg="gray.0">
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Group gap={4} mb={2}>
                        <IconUser size={14} color="gray" />
                        <Text fw={700} size="sm">
                          {period.childName}
                        </Text>
                      </Group>
                      <Group gap={4}>
                        <IconPhone size={14} color="gray" />
                        <Text size="xs" c="dimmed">
                          {period.clientPhone}
                        </Text>
                      </Group>
                    </Box>
                    <Badge variant="outline">Визит: {period.visitCode}</Badge>
                  </Group>

                  <Box
                    p="xs"
                    bg="blue.1"
                    style={{
                      borderRadius: "6px",
                      borderLeft: "4px solid var(--mantine-color-blue-6)",
                    }}
                  >
                    <Text size="xs" fw={700} c="blue.9" mb={2}>
                      ПЕРИОД ЗАНЯТОСТИ:
                    </Text>
                    <Text size="sm" fw={600}>
                      {formatDate(period.startDateTime)}
                    </Text>
                    <Text size="sm" fw={600}>
                      {formatDate(period.endDateTime)}
                    </Text>
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
              {selectedCostume?.noPeriodsMessage || "Периодов занятости нет"}
            </Alert>
          )}

          <Button
            fullWidth
            variant="light"
            color="gray"
            onClick={close}
            size="md"
            mt="md"
          >
            Закрыть
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
