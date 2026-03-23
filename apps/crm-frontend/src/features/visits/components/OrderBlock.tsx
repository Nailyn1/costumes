import {
  ActionIcon,
  Divider,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { IconTrash } from "@tabler/icons-react";
import { ChildSelector } from "src/features/clients-children/components/children/ChildSelector";
import type { BookingFormValues } from "src/pages/CreateBookingPage";

interface OrderBlockProps {
  index: number;
  form: UseFormReturnType<BookingFormValues>;
  clientId: number | null;
  onRemove: () => void;
}

export function OrderBlock({
  index,
  form,
  clientId,
  onRemove,
}: OrderBlockProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Text fw={600}>Заказ №{index + 1}</Text>
        {index !== 0 && (
          <ActionIcon color="red" variant="subtle" onClick={onRemove}>
            <IconTrash size={16} />
          </ActionIcon>
        )}
      </Group>

      <Divider variant="dashed" mb="md" />

      <Stack gap="sm">
        {/* Наш умный селектор ребенка */}
        <ChildSelector
          clientId={clientId}
          {...form.getInputProps(`orders.${index}.childId`)}
        />

        {/* Селектор костюма (пока заглушка) */}
        <TextInput
          label="Костюм"
          placeholder="Название костюма"
          {...form.getInputProps(`orders.${index}.costumeId`)}
        />

        <Group grow>
          <NumberInput
            label="Аренда"
            placeholder="0 ₸"
            {...form.getInputProps(`orders.${index}.rentPrice`)}
          />
          <NumberInput
            label="Предоплата"
            placeholder="0 ₸"
            {...form.getInputProps(`orders.${index}.prepaymentAmount`)}
          />
        </Group>

        <TextInput
          label="Заметка"
          placeholder="Особенности заказа..."
          {...form.getInputProps(`orders.${index}.notes`)}
        />
      </Stack>
    </Paper>
  );
}
