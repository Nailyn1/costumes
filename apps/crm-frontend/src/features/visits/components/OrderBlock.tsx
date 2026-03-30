import {
  ActionIcon,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { IconTrash } from "@tabler/icons-react";
import { ChildSelector } from "src/features/clients-children/components/children/ChildSelector";
import { CostumeSelector } from "src/features/costumes/components/costumeSelector";
import type { BookingFormValues } from "../types/visitTypes";
import { MoneyInput } from "src/components/MoneyInput";

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
  const rentValue = form.values.orders[index].rentPrice || 0;
  const prepaymentValue = form.values.orders[index].prepaymentAmount || 0;

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
        <ChildSelector
          clientId={clientId}
          {...form.getInputProps(`orders.${index}.childId`)}
        />

        <CostumeSelector
          {...form.getInputProps(`orders.${index}.costumeId`)}
          startDateTime={form.values.startDateTime}
          endDateTime={form.values.endDateTime}
          issueTimeFrom={form.values.issueTimeFrom || ""}
          returnTimeUntil={form.values.returnTimeUntil || ""}
        />

        <Group grow>
          <MoneyInput
            label="Аренда"
            placeholder="0 ₸"
            {...form.getInputProps(`orders.${index}.rentPrice`)}
            onChange={(val) => {
              const numericValue = typeof val === "number" ? val : undefined;
              form.setFieldValue(`orders.${index}.rentPrice`, numericValue);

              if (typeof val === "number" && prepaymentValue > val) {
                form.setFieldValue(`orders.${index}.prepaymentAmount`, val);
              }
            }}
          />

          <MoneyInput
            label="Предоплата"
            placeholder="0 ₸"
            max={rentValue}
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
