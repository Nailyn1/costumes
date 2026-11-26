import type { GetVisitsForReturnDto, visitCompleteReturnRequestDto } from "@costumes/shared";
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
  Badge,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowBack,
  IconCash,
  IconCheck,
  IconFileDescription,
} from "@tabler/icons-react";
import { useCompleteReturnVisit, useUnissueVisit } from "../../hooks/useVisits";
import { formatPhoneNumber } from "src/utils/formatters";
import { useState } from "react";
import { MoneyInput } from "src/components/MoneyInput";

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
      returnedItems: [] as number[],
      settleNow: false,
      settlementAmount: "" as number | string,
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
    const due = data.balance.debt || data.balance.refundDue;
    const amount = values.settlementAmount === "" ? due : Number(values.settlementAmount);
    if (values.settleNow && (!Number.isInteger(amount) || amount <= 0 || amount > due)) {
      form.setFieldError("settlementAmount", `Укажите сумму от 1 до ${due} ₸`);
      return;
    }
    const payload: visitCompleteReturnRequestDto = {
      depositReturned: values.depositReturned,
      notes: values.notes,
      ...(values.settleNow && {
        settlement: {
          kind: data.balance.debt > 0 ? "debt_payment" as const : "customer_refund" as const,
          amount,
        },
      }),
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
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box>
            <Text size="lg" fw={600}>
              {data.client.name}
            </Text>
            <Text size="md" c="dimmed">
              {formatPhoneNumber(data.client.phone)}
            </Text>
          </Box>

          {!data.deposit?.type || data.deposit.type === "none" ? (
            <Badge variant="light" size="lg" color="gray">
              Без залога
            </Badge>
          ) : (
            <Badge
              variant="light"
              size="lg"
              color={data.deposit.type === "cash" ? "green" : "blue"}
              leftSection={
                data.deposit.type === "cash" ? (
                  <IconCash size={14} />
                ) : (
                  <IconFileDescription size={14} />
                )
              }
            >
              {data.deposit.type === "cash"
                ? `${data.deposit.amount} ₸`
                : "Документ"}
            </Badge>
          )}
        </Group>

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

        {(data.balance.debt > 0 || data.balance.refundDue > 0) && (
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Text fw={700}>Расчёт по аренде</Text>
              <Text c={data.balance.debt > 0 ? "orange.9" : "red.8"} fw={600}>
                {data.balance.debt > 0
                  ? `Долг клиента: ${data.balance.debt} ₸`
                  : `Вернуть клиенту: ${data.balance.refundDue} ₸`}
              </Text>
              <Checkbox
                label={data.balance.debt > 0 ? "Принять оплату долга сейчас" : "Вернуть переплату сейчас"}
                {...form.getInputProps("settleNow", { type: "checkbox" })}
              />
              {form.values.settleNow && (
                <MoneyInput
                  label={data.balance.debt > 0 ? "Получено от клиента" : "Выдано клиенту"}
                  {...form.getInputProps("settlementAmount")}
                  value={form.values.settlementAmount === "" ? data.balance.debt || data.balance.refundDue : form.values.settlementAmount}
                  max={data.balance.debt || data.balance.refundDue}
                />
              )}
              <Text size="sm" c="dimmed">Костюмы можно вернуть, даже если расчёт пока не завершён.</Text>
            </Stack>
          </Paper>
        )}

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
              Отменить выдачу
            </Button>
          </Stack>
        ) : (
          <Paper withBorder p="md" radius="md" bg="orange.0" mt="sm">
            <Stack gap="sm">
              <Text fw={600} c="orange.9" ta="center">
                Уверены, что хотите отменить выдачу?
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
