import {
  ActionIcon,
  Divider,
  Group,
  Paper,
  Text,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { IconTrash } from "@tabler/icons-react";
import type { BookingFormValues } from "../types/visitTypes";
import { MoneyInput } from "src/components/MoneyInput";
import { clampPrepayment } from "../utils/bookingForm";
import { OrderSelectionFields } from "./OrderSelectionFields";

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

      <OrderSelectionFields
        clientId={clientId}
        value={{ ...form.values.orders[index], rentPrice: form.values.orders[index].rentPrice ?? "" }}
        onChange={(value) => {
          form.setFieldValue(`orders.${index}.childId`, value.childId);
          form.setFieldValue(`orders.${index}.costumeId`, value.costumeId);
          const rentPrice = typeof value.rentPrice === "number" && Number.isFinite(value.rentPrice)
            ? value.rentPrice
            : undefined;
          form.setFieldValue(`orders.${index}.rentPrice`, rentPrice);
          form.setFieldValue(`orders.${index}.notes`, value.notes);
          if (rentPrice !== undefined && prepaymentValue > rentPrice) {
            form.setFieldValue(
              `orders.${index}.prepaymentAmount`,
              clampPrepayment(rentPrice, prepaymentValue),
            );
          }
        }}
        startDateTime={form.values.startDateTime}
        endDateTime={form.values.endDateTime}
        issueTimeFrom={form.values.issueTimeFrom || ""}
        returnTimeUntil={form.values.returnTimeUntil || ""}
        errors={{
          childId: form.errors[`orders.${index}.childId`],
          costumeId: form.errors[`orders.${index}.costumeId`],
          rentPrice: form.errors[`orders.${index}.rentPrice`],
        }}
        rightControl={
          <MoneyInput
            label="Предоплата"
            placeholder="0 ₸"
            max={rentValue}
            {...form.getInputProps(`orders.${index}.prepaymentAmount`)}
          />
        }
      />
    </Paper>
  );
}
