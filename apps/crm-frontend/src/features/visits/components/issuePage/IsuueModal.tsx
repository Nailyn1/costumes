import {
  Modal,
  Stack,
  Group,
  Box,
  Text,
  Divider,
  Paper,
  Badge,
  SimpleGrid,
  SegmentedControl,
  Textarea,
  Button,
  Center,
  Loader,
} from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import type {
  GetVisitForIssueDto,
  VisitIssueRequestDto,
} from "@costumes/shared";
import { useCancelVisit, useIssueVisit } from "../../hooks/useVisits";
import { MoneyInput } from "src/components/MoneyInput";
import { formatPhoneNumber, formatStayDates } from "src/utills/formatters";
import { useForm } from "@mantine/form";
import { useState } from "react";

interface IssueModalProps {
  opened: boolean;
  onClose: () => void;
  visitId: number | null;
  isMobile: boolean;
  data: GetVisitForIssueDto | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function IssueModal({
  opened,
  onClose,
  visitId,
  isMobile,
  data,
  isLoading,
  isError,
}: IssueModalProps) {
  const issueMutation = useIssueVisit();
  const cancelMutation = useCancelVisit();

  const form = useForm({
    initialValues: {
      extraPayment: "" as number | string,
      depositType: "document",
      depositAmount: "" as number | string,
      notes: "",
    },
    validate: {},
  });

  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const handleClose = () => {
    form.reset();
    setIsCanceling(false);
    setCancelReason("");
    onClose();
  };

  const handleConfirmCancel = () => {
    if (!visitId) return;

    cancelMutation.mutate(
      {
        visitId,
        data: { reason: cancelReason || undefined },
      },
      {
        onSuccess: () => {
          handleClose();
        },
      },
    );
  };

  const handleSubmit = form.onSubmit((values) => {
    if (!data || !visitId) return;

    const finalPayment =
      values.extraPayment === ""
        ? data.remainingToPay
        : Number(values.extraPayment);

    const payload: VisitIssueRequestDto = {
      additionalPayment: finalPayment,
      deposit: {
        type: values.depositType as "cash" | "document" | "none",
        ...(values.depositType === "cash" && {
          amount: Number(values.depositAmount) || 0,
        }),
      },
      notes: values.notes,
    };

    issueMutation.mutate(
      { visitId: visitId, data: payload },
      {
        onSuccess: () => {
          handleClose();
        },
      },
    );
  });

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      returnFocus={false}
      title={
        <Text fw={700}>
          Выдача заказа {data ? `#${data.visitCode}` : "костюмов"}
        </Text>
      }
      size="lg"
      fullScreen={isMobile}
    >
      {isLoading && (
        <Center p="xl" mih={200}>
          <Loader color="blue" />
        </Center>
      )}

      {isError && (
        <Center p="xl" mih={200}>
          <Text c="red">Не удалось загрузить данные визита</Text>
        </Center>
      )}

      {data && !isLoading && !isError && (
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Group grow align="flex-start">
              <Box>
                <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                  Клиент
                </Text>
                <Text fw={600} size="lg">
                  {data.client.name}
                </Text>
                <Text size="md">{formatPhoneNumber(data.client.phone)}</Text>
              </Box>
              <Box>
                <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                  Аренда
                </Text>
                <Text fw={600} size="md">
                  {formatStayDates(data.startDateTime, data.endDateTime)}
                </Text>
                <Text size="sm">
                  Выдача: {data.issueTimeFrom} - {data.issueTimeTo}
                </Text>
                <Text size="sm">Вернуть: {data.returnTimeUntil}</Text>
              </Box>
            </Group>

            <Divider
              label={<Text size="md">Заказы</Text>}
              labelPosition="center"
              size="md"
            />

            <Stack gap="xs">
              {data.orders.map((order) => (
                <Paper
                  key={order.orderId}
                  withBorder
                  p="sm"
                  radius="sm"
                  bg="gray.0"
                >
                  <Group
                    justify="space-between"
                    align="flex-start"
                    wrap="nowrap"
                  >
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="md" fw={700}>
                        {order.childName} — {order.costumeName}
                      </Text>
                      <Group gap="sm" mt={4}>
                        <Text size="md" c="dimmed">
                          Код: {order.inventoryCode}
                        </Text>
                        <Badge
                          size="md"
                          color={
                            order.tagStatus === "written" ? "green" : "gray"
                          }
                          variant="light"
                        >
                          {order.tagStatus === "written"
                            ? "Бирка есть"
                            : "Нет бирки"}
                        </Badge>
                      </Group>
                    </Box>
                    <Box
                      style={{
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      <Text size="md" fw={600}>
                        {order.rentPrice} ₸
                      </Text>
                      <Text size="md" c="green.7">
                        Оплачено: {order.prepaymentAmount} ₸
                      </Text>
                      <Text size="md" c="red.7" fw={500}>
                        Остаток: {order.rentPrice - order.prepaymentAmount} ₸
                      </Text>
                    </Box>
                  </Group>
                </Paper>
              ))}
            </Stack>

            <Box p="md" bg="blue.0" style={{ borderRadius: "8px" }}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={700}>Итого к доплате:</Text>
                  <Text fw={700} size="xl" c="blue.9">
                    {data.remainingToPay} ₸
                  </Text>
                </Group>

                <SimpleGrid cols={isMobile ? 1 : 2}>
                  <MoneyInput
                    label="Сумма доплаты (факт)"
                    size="md"
                    {...form.getInputProps("extraPayment")}
                    value={
                      form.values.extraPayment === ""
                        ? data.remainingToPay
                        : form.values.extraPayment
                    }
                  />
                  <Box>
                    <Text size="md" fw={500} mb={3}>
                      Тип залога
                    </Text>
                    <SegmentedControl
                      fullWidth
                      size="md"
                      data={[
                        { label: "Нал", value: "cash" },
                        { label: "Док", value: "document" },
                        { label: "Нет", value: "none" },
                      ]}
                      {...form.getInputProps("depositType")}
                    />
                  </Box>
                </SimpleGrid>

                {form.values.depositType === "cash" && (
                  <MoneyInput
                    label="Сумма залога"
                    {...form.getInputProps("depositAmount")}
                  />
                )}
              </Stack>
            </Box>

            <Textarea
              label="Комментарий к выдаче"
              placeholder="Например: доплатят завтра, костюм без головного убора..."
              minRows={2}
              size="md"
              {...form.getInputProps("notes")}
            />

            {!isCanceling ? (
              <Stack gap="sm" mt="md">
                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  color="green"
                  leftSection={<IconCheck size={20} />}
                  loading={issueMutation.isPending}
                  disabled={cancelMutation.isPending}
                >
                  Выдать костюмы
                </Button>

                <Button
                  type="button"
                  variant="subtle"
                  color="red"
                  leftSection={<IconX size={18} />}
                  onClick={() => setIsCanceling(true)}
                >
                  Отменить визит
                </Button>
              </Stack>
            ) : (
              // РЕЖИМ ОТМЕНЫ: Показываем поле причины и опасные кнопки
              <Paper withBorder p="md" radius="md" bg="red.0" mt="md">
                <Stack gap="sm">
                  <Text fw={600} c="red.9">
                    Подтверждение отмены
                  </Text>

                  <Textarea
                    placeholder="Укажите причину отмены (необязательно)..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.currentTarget.value)}
                    minRows={2}
                    autoFocus
                  />

                  <Group grow>
                    <Button
                      variant="default"
                      onClick={() => setIsCanceling(false)}
                      disabled={cancelMutation.isPending}
                    >
                      Назад
                    </Button>
                    <Button
                      color="red"
                      onClick={handleConfirmCancel}
                      loading={cancelMutation.isPending}
                    >
                      Отменить визит
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            )}
          </Stack>
        </form>
      )}
    </Modal>
  );
}
