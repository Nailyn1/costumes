import { Stack, Button, Divider, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { OrderBlock } from "./OrderBlock";
import type { UseFormReturnType } from "@mantine/form";
import type { BookingFormValues } from "../types/visitTypes";

interface OrderListProps {
  form: UseFormReturnType<BookingFormValues>;
  clientId: number | null;
}

export function OrderList({ form, clientId }: OrderListProps) {
  const addOrder = () => {
    form.insertListItem("orders", {
      childId: null,
      costumeId: null,
      rentPrice: undefined,
      prepaymentAmount: undefined,
      notes: "",
    });
  };

  const removeOrder = (index: number) => {
    if (form.values.orders.length > 1) {
      form.removeListItem("orders", index);
    } else {
      // Сброс последнего оставшегося блока
      form.setFieldValue("orders.0", {
        childId: null,
        costumeId: null,
        rentPrice: undefined,
        prepaymentAmount: undefined,
        notes: "",
      });
    }
  };

  return (
    <Stack gap="md">
      <Divider
        label={
          <Text size="md" fw={700}>
            Заказы
          </Text>
        }
        labelPosition="center"
        size="md"
      />

      {form.values.orders.map((_, index) => (
        <OrderBlock
          key={index}
          index={index}
          form={form}
          clientId={clientId}
          onRemove={() => removeOrder(index)}
        />
      ))}

      <Button
        variant="outline"
        leftSection={<IconPlus size={18} />}
        onClick={addOrder}
        disabled={!clientId}
        fullWidth
      >
        Добавить еще ребенка
      </Button>
    </Stack>
  );
}
