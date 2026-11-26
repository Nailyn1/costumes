import {
  Modal,
  Stack,
  Group,
  Box,
  Text,
  Divider,
  Paper,
  Textarea,
  Button,
  Center,
  Loader,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import type {
  GetVisitForIssueDto,
  VisitIssueRequestDto,
} from "@costumes/shared";
import { useCancelVisit, useIssueVisit } from "../../hooks/useVisits";
import { formatPhoneNumber, formatStayDates } from "src/utils/formatters";
import { useForm } from "@mantine/form";
import { useState } from "react";
import { OrderTagStatusBadge } from "../OrderTagStatusBadge";
import {
  IssueOrderCard,
  IssuePaymentFields,
  IssueSubmitButton,
} from "./IssueDetails";

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
  const actualPayment = data
    ? form.values.extraPayment === ""
      ? data.remainingToPay
      : Number(form.values.extraPayment) || 0
    : 0;

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
      { visitId, visitCode: data.visitCode, data: payload },
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
      closeButtonProps={{
        size: "lg",
        iconSize: 24,
      }}
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
                <IssueOrderCard
                  key={order.orderId}
                  childName={order.childName}
                  costumeName={order.costumeName}
                  inventoryCode={order.inventoryCode}
                  rentPrice={order.rentPrice}
                  prepaymentAmount={order.prepaymentAmount}
                  tagBadge={<OrderTagStatusBadge tagStatus={order.tagStatus} />}
                />
              ))}
            </Stack>
            <IssuePaymentFields
              remainingToPay={data.remainingToPay}
              payment={actualPayment}
              onPaymentChange={(value) =>
                form.setFieldValue("extraPayment", value)
              }
              depositType={
                form.values.depositType as "cash" | "document" | "none"
              }
              onDepositTypeChange={(value) =>
                form.setFieldValue("depositType", value)
              }
              depositAmount={form.values.depositAmount}
              onDepositAmountChange={(value) =>
                form.setFieldValue("depositAmount", value)
              }
              isMobile={isMobile}
            />

            <Textarea
              label="Комментарий к выдаче"
              placeholder="Например: доплатят завтра, костюм без головного убора..."
              minRows={2}
              size="md"
              {...form.getInputProps("notes")}
            />

            {!isCanceling ? (
              <Stack gap="sm" mt="md">
                <IssueSubmitButton
                  loading={issueMutation.isPending}
                  disabled={cancelMutation.isPending}
                />

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
