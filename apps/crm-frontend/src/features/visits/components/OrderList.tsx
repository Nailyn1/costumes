import { Stack, Button, Divider } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { OrderBlock } from "./OrderBlock";
import type { BookingFormValues } from "src/pages/CreateBookingPage"; // Путь к твоим типам
import type { UseFormReturnType } from "@mantine/form";

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
      <Divider label="Заказы" labelPosition="center" />

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
