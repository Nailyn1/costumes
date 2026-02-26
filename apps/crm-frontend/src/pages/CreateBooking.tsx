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
import { DateInput, TimeInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { ClientSelector } from "src/features/clients/components/clientSelector";

export function CreateBookingPage() {
  const form = useForm({
    initialValues: {
      clientId: null,
      // ... другие поля
    },
    validate: {
      clientId: (value) => (!value ? "Выберите клиента" : null),
    },
  });
  return (
    <Stack gap="xl" pb={100}>
      <Title order={2}>Создание брони</Title>

      {/* 1. Блок клиента */}
      <ClientSelector {...form.getInputProps("clientId")} />

      {/* 2. Дата и время визита */}
      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="xs">
          2. Дата и время визита
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <DateInput label="Дата выдачи" placeholder="11.12.2025" locale="ru" />
          <TimeInput label="Забрать с" />
          <TimeInput label="Вернуть до" />
        </SimpleGrid>
        <Text size="xs" c="dimmed" mt="sm">
          Автоматически: Будний день (18:30 – 19:30)
        </Text>
      </Paper>

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
