import {
  Title,
  Text,
  TextInput,
  Button,
  Group,
  Stack,
  Paper,
  Divider,
  NumberInput,
  Select,
  SimpleGrid,
  Box,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { ClientSelector } from "src/features/clients/components/clientSelector";
import { VisitSelector } from "src/features/visits/components/VisitSelector";
import type { VisitData } from "src/features/visits/types/visitDateTypes";

interface BookingFormValues extends VisitData {
  clientId: string | null;
}

export function CreateBookingPage() {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    console.log(`Рендер #${renderCount.current}`);
  });
  const form = useForm<BookingFormValues>({
    initialValues: {
      clientId: null,
      startDateTime: null,
      endDateTime: null,
      issueTimeFrom: "18:30",
      issueTimeTo: "19:30",
      returnTimeUntil: "18:00",
    },
    validate: {
      clientId: (value) => (!value ? "Выберите клиента" : null),
      startDateTime: (value) => (!value ? "Укажите дату выдачи" : null),
      endDateTime: (value) => (!value ? "Укажите дату возврата" : null),
    },
  });
  return (
    <Stack gap="xl" pb={100}>
      <Title order={2}>Создание брони</Title>

      <ClientSelector {...form.getInputProps("clientId")} />

      <VisitSelector
        values={form.values}
        errors={form.errors}
        onChange={(newValues) => form.setValues(newValues)}
      />
      {/* 3. Дети и костюмы (Повторяющийся блок) */}
      <Box>
        <Text fw={600} mb="xs">
          3. Дети и костюмы
        </Text>
        <Stack gap="md">
          <Paper withBorder p="md" radius="md" bg="gray.0">
            <Stack gap="sm">
              <Group grow>
                <Select
                  label="Ребенок"
                  placeholder="Выберите или создайте"
                  data={[]}
                />
                <Select
                  label="Костюм"
                  placeholder="Название или код"
                  data={[]}
                />
              </Group>

              <TextInput
                label="Заметка к костюму"
                placeholder="Например: подшить брюки"
              />

              <Divider label="Финансы по ребенку" labelPosition="center" />

              <Group grow>
                <NumberInput label="Аренда" placeholder="0" suffix=" ₸" />
                <NumberInput label="Внесено" placeholder="0" suffix=" ₸" />
                <TextInput
                  label="Осталось"
                  variant="filled"
                  readOnly
                  value="0 ₸"
                />
              </Group>

              <Button
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={14} />}
                size="xs"
                mt="xs"
              >
                Удалить ребенка
              </Button>
            </Stack>
          </Paper>

          <Button
            variant="outline"
            leftSection={<IconPlus size={16} />}
            fullWidth
          >
            Добавить еще одного ребенка
          </Button>
        </Stack>
      </Box>

      {/* 4. Итоговая панель (Sticky bottom или просто внизу) */}
      <Paper withBorder p="xl" radius="md" shadow="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={700} size="lg">
              Итого по визиту:
            </Text>
            <Stack gap={0} align="flex-end">
              <Text size="xl" fw={800} c="blue">
                1 500 ₸
              </Text>
              <Text size="xs" c="dimmed">
                Всего внесено: 500 ₸
              </Text>
            </Stack>
          </Group>

          <SimpleGrid cols={2} mt="md">
            <Button size="lg" variant="light" color="gray">
              Проверить
            </Button>
            <Button size="lg" color="blue">
              Подтвердить и создать
            </Button>
          </SimpleGrid>
        </Stack>
      </Paper>
    </Stack>
  );
}
