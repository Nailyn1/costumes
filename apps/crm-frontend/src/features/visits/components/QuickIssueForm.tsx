import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Radio,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { useForm, schemaResolver } from "@mantine/form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  QuickIssueVisitRequestSchema,
  TypedStatusError,
  type QuickIssueVisitRequestDto,
  type QuickIssueVisitResponseDto,
} from "@costumes/shared";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MoneyInput } from "src/components/MoneyInput";
import { useVisitPreviewCode } from "../hooks/useVisits";
import { useQuickIssue } from "../hooks/useQuickIssue";
import { OrderSelectionFields } from "./OrderSelectionFields";
import { SmartDateInput } from "./SmartDateInput";
import type { VisitOrder } from "../types/visitTypes";
import { toISODateString } from "../utils/bookingForm";
import {
  clearPendingQuickIssueRequest,
  getPendingQuickIssueRequest,
  savePendingQuickIssueRequest,
} from "../utils/quickIssueRequestStorage";
import { useAuthStore } from "src/stores/auth.store";
import { clientKeys } from "src/features/clients-children/hooks/useClients";
import type { SelectedClientData } from "src/features/clients-children/types/clientTypes";
import { costumesKeys } from "src/features/costumes/hooks/useCostumes";
import type { SelectedCostumeData } from "src/features/costumes/types/costumeTypes";
import { formatVisitDate } from "../utils/visitReadFormatters";

interface QuickIssueFormProps {
  active: boolean;
  clientId: string | null;
  orders: VisitOrder[];
  notes: string;
  prepaymentTotal: number;
  onOrdersChange: (orders: VisitOrder[]) => void;
  onNotesChange: (notes: string) => void;
  onStartAnother: () => void;
  onPendingChange: (pending: boolean) => void;
}

function localDate(date: Date): string {
  return toISODateString(date);
}

function addLocalDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  return localDate(new Date(year, month - 1, day + days));
}

function currentLocalTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function createInitialRequest(
  clientId: string | null,
  orders: VisitOrder[],
  notes: string,
): QuickIssueVisitRequestDto {
  const now = new Date();
  const startDateTime = localDate(now);
  return {
    commandId: crypto.randomUUID(),
    clientId: Number(clientId) || 0,
    visitCode: "0000",
    startDateTime,
    issueTimeFrom: currentLocalTime(now),
    issueTimeTo: currentLocalTime(now),
    endDateTime: addLocalDays(startDateTime, 1),
    returnTimeUntil: "18:00",
    notes,
    orders: orders.map((order) => ({
      childId: order.childId ?? 0,
      costumeId: order.costumeId ?? 0,
      rentPrice: order.rentPrice ?? 0,
      ...(order.notes ? { notes: order.notes } : {}),
    })),
    additionalPayment: 0,
    deposit: { type: "none" },
  };
}

function getFailureStatus(error: unknown): number | null {
  if (error instanceof TypedStatusError) return error.response.status;
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = error.response;
    if (
      typeof response === "object" &&
      response !== null &&
      "status" in response &&
      typeof response.status === "number"
    ) {
      return response.status;
    }
  }
  return null;
}

function isAmbiguousFailure(error: unknown): boolean {
  const status = getFailureStatus(error);
  if (status === 409) return !isDefinitiveQuickIssueConflict(error);
  if (status === null || [401, 408, 425, 429].includes(status) || status >= 500) {
    return true;
  }
  return false;
}

function getErrorCode(error: unknown): string | null {
  const data =
    error instanceof TypedStatusError
      ? error.response.data
      : typeof error === "object" && error !== null && "response" in error
        ? (error.response as { data?: unknown } | undefined)?.data
        : undefined;
  if (typeof data !== "object" || data === null || !("code" in data)) return null;
  return typeof data.code === "string" ? data.code : null;
}

function isDefinitiveQuickIssueConflict(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === "QUICK_ISSUE_CODE_EXPIRED" || code === "VISIT_CODE_ALREADY_USED";
}

function createRequestId(): string {
  return crypto.randomUUID();
}

export function QuickIssueForm({
  active,
  clientId,
  orders,
  notes,
  prepaymentTotal,
  onOrdersChange,
  onNotesChange,
  onStartAnother,
  onPendingChange,
}: QuickIssueFormProps) {
  const userLogin = useAuthStore((state) => state.user?.login ?? null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const queryClient = useQueryClient();
  const form = useForm<QuickIssueVisitRequestDto>({
    initialValues: createInitialRequest(clientId, orders, notes),
    validate: schemaResolver(QuickIssueVisitRequestSchema),
  });
  const [pendingRequest, setPendingRequest] = useState(() =>
    getPendingQuickIssueRequest(useAuthStore.getState().user?.login ?? null),
  );
  const [reviewOpened, setReviewOpened] = useState(false);
  const [success, setSuccess] = useState<QuickIssueVisitResponseDto | null>(null);
  const previewCode = useVisitPreviewCode();
  const quickIssue = useQuickIssue();

  useEffect(() => {
    onPendingChange(Boolean(pendingRequest));
  }, [onPendingChange, pendingRequest]);

  useEffect(() => {
    if (!active || pendingRequest) return;
    const nextOrders = orders.map((order) => ({
      childId: order.childId ?? 0,
      costumeId: order.costumeId ?? 0,
      rentPrice: order.rentPrice ?? 0,
      ...(order.notes ? { notes: order.notes } : {}),
    }));
    const currentOrders = form.values.orders;
    const ordersChanged =
      JSON.stringify(currentOrders) !== JSON.stringify(nextOrders);
    if (ordersChanged) form.setFieldValue("orders", nextOrders);
    const numericClientId = Number(clientId) || 0;
    if (form.values.clientId !== numericClientId) {
      form.setFieldValue("clientId", numericClientId);
    }
    if (form.values.notes !== notes) form.setFieldValue("notes", notes);
  }, [active, clientId, form, notes, orders, pendingRequest]);

  const locked = Boolean(pendingRequest) || quickIssue.isPending;
  const setParentOrder = (index: number, order: VisitOrder) => {
    const nextOrders = orders.map((current, orderIndex) =>
      orderIndex === index ? order : current,
    );
    onOrdersChange(nextOrders);
  };

  const handleReview = () => {
    const result = form.validate();
    let invalid = result.hasErrors;
    if (!Number(clientId)) {
      form.setFieldError("clientId", "Выберите клиента");
      invalid = true;
    } else {
      form.clearFieldError("clientId");
    }
    orders.forEach((order, index) => {
      if (!order.childId) {
        form.setFieldError(`orders.${index}.childId`, "Выберите ребенка");
        invalid = true;
      } else form.clearFieldError(`orders.${index}.childId`);
      if (!order.costumeId) {
        form.setFieldError(`orders.${index}.costumeId`, "Выберите костюм");
        invalid = true;
      } else form.clearFieldError(`orders.${index}.costumeId`);
      if (order.rentPrice === undefined) {
        form.setFieldError(`orders.${index}.rentPrice`, "Введите сумму аренды");
        invalid = true;
      } else form.clearFieldError(`orders.${index}.rentPrice`);
    });
    if (invalid) return;

    previewCode.mutate(undefined, {
      onSuccess: (code) => {
        form.setFieldValue("visitCode", code);
        setReviewOpened(true);
      },
    });
  };

  const runCommand = async (request: QuickIssueVisitRequestDto) => {
    if (!savePendingQuickIssueRequest(userLogin, request)) {
      notifications.show({
        title: "Не удалось сохранить выдачу для повтора",
        message: "Разрешите хранение данных сеанса в браузере и повторите подтверждение.",
        color: "red",
      });
      return;
    }
    setPendingRequest(request);
    try {
      const result = await quickIssue.mutateAsync(request);
      clearPendingQuickIssueRequest(userLogin);
      setPendingRequest(null);
      setSuccess(result);
      setReviewOpened(false);
    } catch (error) {
      if (isAmbiguousFailure(error)) {
        notifications.show({
          title: "Результат выдачи пока неизвестен",
          message: "Повторите отправку этой команды. Состав и сумма останутся прежними.",
          color: "orange",
        });
      } else {
        clearPendingQuickIssueRequest(userLogin);
        setPendingRequest(null);
        form.setFieldValue("commandId", createRequestId());
      }
    }
  };

  const handleConfirm = () => {
    const now = new Date();
    const actualStartDate = localDate(now);
    if (form.values.endDateTime < actualStartDate) {
      form.setFieldError("endDateTime", "Дата возврата не может быть раньше сегодняшнего дня");
      setReviewOpened(false);
      return;
    }
    const candidate: QuickIssueVisitRequestDto = {
      ...form.values,
      commandId: createRequestId(),
      clientId: Number(clientId),
      startDateTime: actualStartDate,
      issueTimeFrom: currentLocalTime(now),
      issueTimeTo: currentLocalTime(now),
      notes: notes || undefined,
      orders: orders.map((order) => ({
        childId: Number(order.childId),
        costumeId: Number(order.costumeId),
        rentPrice: Number(order.rentPrice),
        ...(order.notes ? { notes: order.notes } : {}),
      })),
      deposit: {
        type: form.values.deposit.type,
        ...(form.values.deposit.type === "cash" && form.values.deposit.amount !== undefined
          ? { amount: form.values.deposit.amount }
          : {}),
      },
    };
    const parsed = QuickIssueVisitRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      notifications.show({
        title: "Проверьте данные выдачи",
        message: "Дата, время или суммы не соответствуют формату.",
        color: "red",
      });
      return;
    }
    form.setFieldValue("commandId", parsed.data.commandId);
    setReviewOpened(false);
    void runCommand(parsed.data);
  };

  const addOrder = () => {
    if (locked) return;
    const blank: VisitOrder = {
      childId: null,
      costumeId: null,
      rentPrice: undefined,
      prepaymentAmount: undefined,
      notes: "",
    };
    onOrdersChange([...orders, blank]);
    form.insertListItem("orders", { childId: 0, costumeId: 0, rentPrice: 0 });
  };

  const removeOrder = (index: number) => {
    if (locked) return;
    const nextOrders = orders.filter((_, orderIndex) => orderIndex !== index);
    onOrdersChange(nextOrders);
    form.removeListItem("orders", index);
  };

  const totalRent = orders.reduce((sum, order) => sum + (order.rentPrice ?? 0), 0);
  const depositAmount = form.values.deposit.type === "cash" ? form.values.deposit.amount ?? 0 : 0;
  const cachedClient = queryClient.getQueryData<SelectedClientData>(
    clientKeys.formState(clientId ?? ""),
  );
  const childLabel = (childId: number) =>
    cachedClient?.children?.find((child) => child.childId === childId)?.name ?? `Ребёнок #${childId}`;
  const costumeLabel = (costumeId: number) => {
    const costume = queryClient.getQueryData<SelectedCostumeData>(costumesKeys.detail(costumeId));
    return costume?.name ?? `Костюм #${costumeId}`;
  };
  const depositLabel = form.values.deposit.type === "cash"
    ? `Деньги · ${depositAmount.toLocaleString("ru-RU")} ₸`
    : form.values.deposit.type === "document"
      ? "Документ"
      : "Без залога";

  if (success && active) {
    return (
      <Paper withBorder p="lg" radius="md" bg="green.0">
        <Stack>
          <Group justify="space-between">
            <Text fw={700} size="lg">Выдача оформлена</Text>
            <Badge color="green">Выдано</Badge>
          </Group>
          <Text>Код визита</Text>
          <Text size="3rem" fw={900} c="green.9" ta="center">{success.visitCode}</Text>
          <Text ta="center">Получено по операциям: {success.balance.totalReceived.toLocaleString("ru-RU")} ₸</Text>
          <Text ta="center">Долг: {success.balance.debt.toLocaleString("ru-RU")} ₸ · к возврату: {success.balance.refundDue.toLocaleString("ru-RU")} ₸</Text>
          <Button component={Link} to={`/bookings/visits/${success.visitId}`} variant="light">Открыть визит</Button>
          <Button onClick={onStartAnother}>Создать следующую выдачу</Button>
        </Stack>
      </Paper>
    );
  }

  if (pendingRequest) {
    const requestTotalRent = pendingRequest.orders.reduce((sum, order) => sum + order.rentPrice, 0);
    const requestDepositLabel = pendingRequest.deposit.type === "cash"
      ? `Деньги · ${(pendingRequest.deposit.amount ?? 0).toLocaleString("ru-RU")} ₸`
      : pendingRequest.deposit.type === "document"
        ? "Документ"
        : "Без залога";
    return (
      <Paper withBorder p="md" radius="md" bg="orange.0">
        <Stack>
          <Text fw={700}>Выдача ещё не подтверждена</Text>
          <Text>Код визита: {pendingRequest.visitCode}</Text>
          <Text>Клиент #{pendingRequest.clientId} · {formatVisitDate(pendingRequest.startDateTime)} {pendingRequest.issueTimeFrom}</Text>
          <Text>Возврат: {formatVisitDate(pendingRequest.endDateTime)} до {pendingRequest.returnTimeUntil}</Text>
          <Divider />
          {pendingRequest.orders.map((order, index) => (
            <Text key={`${order.childId}-${order.costumeId}-${index}`} size="sm">
              {childLabel(order.childId)} — {costumeLabel(order.costumeId)} · {order.rentPrice.toLocaleString("ru-RU")} ₸
            </Text>
          ))}
          <Text fw={600}>Итого аренда: {requestTotalRent.toLocaleString("ru-RU")} ₸</Text>
          <Text>Получено сейчас: {pendingRequest.additionalPayment.toLocaleString("ru-RU")} ₸ · залог: {requestDepositLabel}</Text>
          <Text size="sm">Состав и сумма заблокированы до выяснения результата. Повторная отправка использует ту же команду.</Text>
          <Button loading={quickIssue.isPending} onClick={() => void runCommand(pendingRequest)}>
            Повторить выдачу
          </Button>
        </Stack>
      </Paper>
    );
  }

  if (!active) return null;

  return (
    <Stack>
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={700}>Срок аренды</Text>
            <Badge color="blue" variant="light">Выдача сегодня</Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Дата выдачи" value={formatVisitDate(form.values.startDateTime)} readOnly />
            <TextInput label="Время выдачи" value="В момент подтверждения" readOnly />
            <div />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <SmartDateInput
              label="Дата возврата"
              value={form.values.endDateTime}
              onChange={(value) => {
                form.setFieldValue("endDateTime", value ?? "");
                void queryClient.invalidateQueries({ queryKey: ["costumes", "list", "search"] });
              }}
              minDate={form.values.startDateTime}
              error={form.errors.endDateTime}
            />
            <TimeInput
              label="Вернуть до"
              value={form.values.returnTimeUntil}
              onChange={(event) => {
                form.setFieldValue("returnTimeUntil", event.currentTarget.value);
                void queryClient.invalidateQueries({ queryKey: ["costumes", "list", "search"] });
              }}
              error={form.errors.returnTimeUntil}
            />
          </SimpleGrid>
        </Stack>
      </Paper>

      <Stack gap="md">
        <Divider label={<Text fw={700}>Заказы</Text>} labelPosition="center" />
        {orders.map((order, index) => (
          <Paper key={index} withBorder p="md" radius="md">
            <Group justify="space-between" mb="xs">
              <Text fw={600}>Заказ №{index + 1}</Text>
              {orders.length > 1 && (
                <ActionIcon color="red" variant="subtle" disabled={locked} onClick={() => removeOrder(index)}>
                  <IconTrash size={16} />
                </ActionIcon>
              )}
            </Group>
            <Divider variant="dashed" mb="md" />
            <OrderSelectionFields
              clientId={Number(clientId) || null}
              value={{ ...order, rentPrice: order.rentPrice ?? "" }}
              onChange={(value) => {
                const rentPrice = typeof value.rentPrice === "number" && Number.isFinite(value.rentPrice)
                  ? value.rentPrice
                  : undefined;
                const nextOrder = { ...order, ...value, rentPrice };
                setParentOrder(index, nextOrder);
                const apiOrder = {
                  childId: value.childId ?? 0,
                  costumeId: value.costumeId ?? 0,
                  rentPrice: rentPrice ?? 0,
                  ...(value.notes ? { notes: value.notes } : {}),
                };
                form.setFieldValue(`orders.${index}`, apiOrder);
              }}
              startDateTime={form.values.startDateTime}
              endDateTime={form.values.endDateTime}
              issueTimeFrom={form.values.issueTimeFrom}
              returnTimeUntil={form.values.returnTimeUntil}
              errors={{
                childId: form.errors[`orders.${index}.childId`],
                costumeId: form.errors[`orders.${index}.costumeId`],
                rentPrice: form.errors[`orders.${index}.rentPrice`],
              }}
              disabled={locked}
            />
          </Paper>
        ))}
        <Button variant="outline" leftSection={<IconPlus size={18} />} onClick={addOrder} disabled={locked || !clientId} fullWidth>
          Добавить еще заказ
        </Button>
      </Stack>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Text fw={700}>Оплата и залог</Text>
          <Text size="sm" c="dimmed">В быстрой выдаче укажите всю полученную сумму в поле «Получено сейчас».</Text>
          {prepaymentTotal > 0 && (
            <Text size="sm" c="orange.9">Предоплата из черновика брони не переносится.</Text>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <MoneyInput
              label="Получено сейчас"
              value={form.values.additionalPayment}
              onChange={(value) => form.setFieldValue("additionalPayment", typeof value === "number" ? value : 0)}
              disabled={locked}
            />
            <Radio.Group
              label="Залог"
              value={form.values.deposit.type}
              onChange={(value) => {
                if (locked) return;
                if (value === "cash" || value === "document" || value === "none") {
                  form.setFieldValue("deposit.type", value);
                  if (value !== "cash") form.setFieldValue("deposit.amount", undefined);
                }
              }}
            >
              <Group mt="xs">
                <Radio value="none" label="Без залога" disabled={locked} />
                <Radio value="cash" label="Деньги" disabled={locked} />
                <Radio value="document" label="Документ" disabled={locked} />
              </Group>
            </Radio.Group>
          </SimpleGrid>
          {form.values.deposit.type === "cash" && (
            <MoneyInput
              label="Сумма денежного залога"
              value={form.values.deposit.amount}
              onChange={(value) => form.setFieldValue("deposit.amount", typeof value === "number" ? value : undefined)}
              disabled={locked}
            />
          )}
          <TextInput
            label="Заметка к визиту"
            value={notes}
            onChange={(event) => onNotesChange(event.currentTarget.value)}
            disabled={locked}
          />
          <Group justify="space-between">
            <Text fw={600}>Итого аренда: {totalRent.toLocaleString("ru-RU")} ₸</Text>
            <Text fw={600}>Залог: {depositAmount.toLocaleString("ru-RU")} ₸</Text>
          </Group>
        </Stack>
      </Paper>

      {pendingRequest ? (
        null
      ) : (
        <Button size="lg" onClick={handleReview} loading={previewCode.isPending} disabled={!clientId}>
          Проверить и выдать
        </Button>
      )}

      <Modal opened={reviewOpened} onClose={() => setReviewOpened(false)} title="Подтвердите выдачу" centered fullScreen={isMobile}>
        <Stack>
          <Text>Код визита: <Text component="span" fw={700}>{form.values.visitCode}</Text></Text>
          {orders.map((order, index) => (
            <Text key={`${order.childId}-${order.costumeId}-${index}`} size="sm">
              {childLabel(order.childId ?? 0)} — {costumeLabel(order.costumeId ?? 0)} · {(order.rentPrice ?? 0).toLocaleString("ru-RU")} ₸
            </Text>
          ))}
          <Text>Возврат: {formatVisitDate(form.values.endDateTime)} до {form.values.returnTimeUntil}</Text>
          <Text>Итого аренда: {totalRent.toLocaleString("ru-RU")} ₸</Text>
          <Text>Получено сейчас: {form.values.additionalPayment.toLocaleString("ru-RU")} ₸</Text>
          <Text>Залог: {depositLabel}</Text>
          <Text size="sm" c="dimmed">Время выдачи будет зафиксировано в момент подтверждения.</Text>
          {isMobile ? (
            <Stack>
              <Button fullWidth variant="default" onClick={() => setReviewOpened(false)} disabled={quickIssue.isPending}>Назад</Button>
              <Button fullWidth onClick={handleConfirm} loading={quickIssue.isPending}>Подтвердить и выдать</Button>
            </Stack>
          ) : (
            <Group grow>
              <Button variant="default" onClick={() => setReviewOpened(false)} disabled={quickIssue.isPending}>Назад</Button>
              <Button onClick={handleConfirm} loading={quickIssue.isPending}>Подтвердить и выдать</Button>
            </Group>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
