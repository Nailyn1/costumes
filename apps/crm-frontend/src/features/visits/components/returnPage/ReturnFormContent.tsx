import type { GetVisitsForReturnDto } from "@costumes/shared";
import {
  Stack,
  Group,
  Box,
  Text,
  Divider,
  Paper,
  Checkbox,
  Textarea,
  Button,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconArrowBack, IconCheck } from "@tabler/icons-react";
import { useCompleteReturnVisit, useUnissueVisit } from "../../hooks/useVisits";
import { formatPhoneNumber } from "src/utills/formatters";
import { useState } from "react";

interface ReturnFormContentProps {
  visitId: number;
  data: GetVisitsForReturnDto;
  onClose: () => void;
}

export function ReturnFormContent({
  data,
  visitId,
  onClose,
}: ReturnFormContentProps) {
  const returnMutation = useCompleteReturnVisit();
  const unissueMutation = useUnissueVisit();

  const [isUnissuing, setIsUnissuing] = useState(false);

  const form = useForm({
    initialValues: {
      depositReturned: data.deposit?.type !== "none",
      notes: "",
      returnedItems: data.orders.map((order) => order.orderId),
    },
  });

  const toggleItem = (id: number) => {
    const currentItems = form.values.returnedItems;
    form.setFieldValue(
      "returnedItems",
      currentItems.includes(id)
        ? currentItems.filter((i) => i !== id)
        : [...currentItems, id],
    );
  };

  const handleSubmit = form.onSubmit((values) => {
    const payload = {
      depositReturned: values.depositReturned,
      notes: values.notes,
    };

    returnMutation.mutate(
      { visitId, data: payload },
      { onSuccess: () => onClose() },
    );
  });

  const handleConfirmUnissue = () => {
    unissueMutation.mutate({ visitId }, { onSuccess: () => onClose() });
  };

  const allItemsSelected =
    data.orders.length > 0 &&
    data.orders.length === form.values.returnedItems.length;

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Box>
          <Text size="lg" fw={600}>
            {data.client.name}
          </Text>
          <Text size="md" c="dimmed">
            {formatPhoneNumber(data.client.phone)}
          </Text>
        </Box>

        <Divider
          label={<Text size="md">Возвращенные костюмы</Text>}
          labelPosition="center"
          size="md"
        />

        <Stack gap="xs">
          {data.orders.map((order) => {
            const isSelected = form.values.returnedItems.includes(
              order.orderId,
            );

            return (
              <Paper
                key={order.orderId}
                withBorder
                p="sm"
                radius="md"
                onClick={() => toggleItem(order.orderId)}
                style={{
                  cursor: "pointer",
                  backgroundColor: isSelected
                    ? "var(--mantine-color-green-0)"
                    : "transparent",
                  borderColor: isSelected
                    ? "var(--mantine-color-green-4)"
                    : undefined,
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="md" fw={700} truncate="end">
                      {order.costumeName}
                    </Text>
                    <Text size="md" c="dimmed">
                      {order.childName} | Код: {order.inventoryCode}
                    </Text>
                  </Box>
                  <Checkbox
                    checked={isSelected}
                    onChange={() => {}}
                    color="green"
                    size="md"
                    style={{ pointerEvents: "none" }}
                  />
                </Group>
              </Paper>
            );
          })}
        </Stack>

        {data.deposit?.type !== "none" && (
          <Box bg="gray.0" p="sm" style={{ borderRadius: "8px" }}>
            <Checkbox
              label="Залог возвращён клиенту"
              {...form.getInputProps("depositReturned", {
                type: "checkbox",
              })}
            />
          </Box>
        )}

        <Textarea
          size="md"
          label="Комментарий при возврате"
          placeholder="Например: сдали не вовремя, испортили костюм"
          minRows={2}
          {...form.getInputProps("notes")}
        />

        {!isUnissuing ? (
          <Stack gap="sm" mt="sm">
            <Button
              type="submit"
              fullWidth
              size="lg"
              color="green"
              disabled={!allItemsSelected || unissueMutation.isPending}
              loading={returnMutation.isPending}
              leftSection={<IconCheck size={20} />}
            >
              Костюмы возвращены
            </Button>

            {!allItemsSelected && (
              <Text size="xs" c="dimmed" ta="center">
                Кнопка станет активной, когда вы отметите все костюмы
              </Text>
            )}

            <Button
              type="button"
              variant="subtle"
              color="orange"
              leftSection={<IconArrowBack size={18} />}
              onClick={() => setIsUnissuing(true)}
              disabled={returnMutation.isPending}
            >
              Откатить выдачу
            </Button>
          </Stack>
        ) : (
          <Paper withBorder p="md" radius="md" bg="orange.0" mt="sm">
            <Stack gap="sm">
              <Text fw={600} c="orange.9" ta="center">
                Уверены, что хотите откатить выдачу?
              </Text>
              <Text size="sm" c="orange.9" ta="center" mt="-sm">
                Визит снова появится в списке ожидающих выдачи.
              </Text>

              <Group grow mt="xs">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setIsUnissuing(false)}
                  disabled={unissueMutation.isPending}
                >
                  Назад
                </Button>
                <Button
                  type="button"
                  color="orange"
                  onClick={handleConfirmUnissue}
                  loading={unissueMutation.isPending}
                >
                  Подтвердить
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}
      </Stack>
    </form>
  );
}
