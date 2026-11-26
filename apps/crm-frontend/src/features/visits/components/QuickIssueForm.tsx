import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { useForm, schemaResolver, type FormErrors } from "@mantine/form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  QuickIssueVisitRequestSchema,
  TypedStatusError,
  type QuickIssueVisitRequestDto,
} from "@costumes/shared";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IssueOrderCard,
  IssuePaymentFields,
  IssueSubmitButton,
} from "./issuePage/IssueDetails";
import { WhatsappAvailabilityNotice } from "src/features/clients-children/components/clients/WhatsappAvailabilityNotice";
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
import { clientsService } from "src/features/clients-children/services/clients.service";
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
  onClientError: (error: string | null) => void;
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
    deposit: { type: "document" },
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
  if (
    status === null ||
    [401, 408, 425, 429].includes(status) ||
    status >= 500
  ) {
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
  if (typeof data !== "object" || data === null || !("code" in data))
    return null;
  return typeof data.code === "string" ? data.code : null;
}

function isDefinitiveQuickIssueConflict(error: unknown): boolean {
  const code = getErrorCode(error);
  return (
    code === "QUICK_ISSUE_CODE_EXPIRED" || code === "VISIT_CODE_ALREADY_USED"
  );
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
  onClientError,
}: QuickIssueFormProps) {
  const userLogin = useAuthStore((state) => state.user?.login ?? null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const queryClient = useQueryClient();
  const form = useForm<
    QuickIssueVisitRequestDto,
    QuickIssueVisitRequestDto,
    FormErrors | Promise<FormErrors>
  >({
    initialValues: createInitialRequest(clientId, orders, notes),
    validate: schemaResolver(QuickIssueVisitRequestSchema),
  });
  const [pendingRequest, setPendingRequest] = useState(() =>
    getPendingQuickIssueRequest(useAuthStore.getState().user?.login ?? null),
  );
  const [reviewOpened, setReviewOpened] = useState(false);
  const [manualPayment, setManualPayment] = useState<number | string | null>(
    null,
  );
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const confirmingRef = useRef(false);
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

  const totalRent = orders.reduce(
    (sum, order) => sum + (order.rentPrice ?? 0),
    0,
  );
  const actualPayment = manualPayment === null ? totalRent : manualPayment;

  const makeRequest = (): QuickIssueVisitRequestDto => {
    const now = new Date();
    return {
      ...form.values,
      commandId: createRequestId(),
      clientId: Number(clientId),
      startDateTime: localDate(now),
      issueTimeFrom: currentLocalTime(now),
      issueTimeTo: currentLocalTime(now),
      additionalPayment:
        actualPayment === "" ? Number.NaN : Number(actualPayment),
      notes: notes || undefined,
      orders: orders.map((order) => ({
        childId: Number(order.childId),
        costumeId: Number(order.costumeId),
        rentPrice: order.rentPrice ?? Number.NaN,
        ...(order.notes ? { notes: order.notes } : {}),
      })),
      deposit: {
        type: form.values.deposit.type,
        ...(form.values.deposit.type === "cash"
          ? { amount: form.values.deposit.amount }
          : {}),
      },
    };
  };

  const validateRequest = async (
    candidate: QuickIssueVisitRequestDto,
    paymentStep: boolean,
  ) => {
    const errors = await schemaResolver(QuickIssueVisitRequestSchema)(
      paymentStep
        ? candidate
        : {
            ...candidate,
            additionalPayment: 0,
            deposit: { type: "document" },
          },
    );
    if (!Number(clientId)) errors.clientId = "Выберите клиента";
    const seen = new Set<number>();
    orders.forEach((order, index) => {
      if (!order.childId)
        errors[`orders.${index}.childId`] = "Выберите ребёнка";
      if (!order.costumeId)
        errors[`orders.${index}.costumeId`] = "Выберите костюм";
      else if (seen.has(order.costumeId))
        errors[`orders.${index}.costumeId`] =
          "Этот костюм уже выбран в другом заказе";
      else seen.add(order.costumeId);
      if (
        order.rentPrice === undefined ||
        !Number.isSafeInteger(order.rentPrice) ||
        order.rentPrice < 0
      )
        errors[`orders.${index}.rentPrice`] =
          "Укажите целую сумму аренды не меньше 0 ₸";
    });
    if (errors.endDateTime)
      errors.endDateTime = "Укажите корректную дату возврата";
    if (errors.returnTimeUntil)
      errors.returnTimeUntil = "Укажите время возврата";
    if (
      candidate.endDateTime < candidate.startDateTime ||
      (candidate.endDateTime === candidate.startDateTime &&
        candidate.returnTimeUntil <= candidate.issueTimeFrom)
    ) {
      errors.endDateTime = "Возврат должен быть позже момента выдачи";
    }
    if (errors.additionalPayment)
      errors.additionalPayment = "Укажите целую полученную сумму не меньше 0 ₸";
    if (errors["deposit.amount"])
      errors["deposit.amount"] = "Укажите корректную сумму денежного залога";
    const messages = Object.entries(errors).map(([path, error]) => {
      const match = /^orders\.(\d+)\./.exec(path);
      return `${match ? `Заказ №${Number(match[1]) + 1}: ` : ""}${typeof error === "string" ? error : "Проверьте поле"}`;
    });
    form.setErrors(errors);
    onClientError(typeof errors.clientId === "string" ? errors.clientId : null);
    setValidationMessages(messages);
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        const path = Object.keys(errors)[0];
        const orderMatch = /^orders\.(\d+)\./.exec(path);
        const selector = `[data-quick-field="${orderMatch ? `orders.${orderMatch[1]}` : path}"]`;
        const field =
          rootRef.current?.querySelector<HTMLElement>(selector) ??
          document.querySelector<HTMLElement>(selector);
        field?.scrollIntoView({ block: "center", behavior: "smooth" });
        field
          ?.querySelector<HTMLElement>("[aria-invalid=true], input, button")
          ?.focus();
      });
    }
    return messages.length === 0;
  };

  const handleReview = async () => {
    const candidate = makeRequest();
    if (!(await validateRequest(candidate, false))) return;
    setReviewError(null);
    form.setValues({
      startDateTime: candidate.startDateTime,
      issueTimeFrom: candidate.issueTimeFrom,
      issueTimeTo: candidate.issueTimeTo,
    });
    try {
      const code = await previewCode.mutateAsync();
      form.setFieldValue("visitCode", code);
      setReviewOpened(true);
    } catch {
      setValidationMessages([
        "Не удалось подготовить код визита. Повторите проверку.",
      ]);
    }
  };

  const runCommand = async (request: QuickIssueVisitRequestDto) => {
    if (!savePendingQuickIssueRequest(userLogin, request)) {
      notifications.show({
        title: "Не удалось сохранить выдачу для повтора",
        message:
          "Разрешите хранение данных сеанса в браузере и повторите подтверждение.",
        color: "red",
      });
      return;
    }
    setPendingRequest(request);
    try {
      await quickIssue.mutateAsync(request);
      clearPendingQuickIssueRequest(userLogin);
      setPendingRequest(null);
      setReviewOpened(false);
      onStartAnother();
    } catch (error) {
      if (isAmbiguousFailure(error)) {
        notifications.show({
          title: "Результат выдачи пока неизвестен",
          message:
            "Повторите отправку этой команды. Состав и сумма останутся прежними.",
          color: "orange",
        });
      } else {
        clearPendingQuickIssueRequest(userLogin);
        setPendingRequest(null);
        form.setFieldValue("commandId", createRequestId());
        setReviewError(
          isDefinitiveQuickIssueConflict(error)
            ? "Код визита устарел. Нажмите «Назад» и повторите проверку."
            : "Не удалось оформить выдачу. Проверьте данные и повторите попытку.",
        );
        setReviewOpened(true);
      }
    }
  };

  const handleConfirm = async () => {
    if (confirmingRef.current || locked) return;
    confirmingRef.current = true;
    try {
      const candidate = makeRequest();
      if (!(await validateRequest(candidate, true))) {
        if (
          candidate.endDateTime < candidate.startDateTime ||
          (candidate.endDateTime === candidate.startDateTime &&
            candidate.returnTimeUntil <= candidate.issueTimeFrom)
        )
          setReviewOpened(false);
        return;
      }
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
      await runCommand(parsed.data);
    } finally {
      confirmingRef.current = false;
    }
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

  const { data: cachedClient } = useQuery<SelectedClientData>({
    queryKey: clientKeys.formState(clientId ?? ""),
    queryFn: skipToken,
    enabled: false,
  });
  const clientDetail = useQuery({
    queryKey: clientKeys.detail(Number(clientId)),
    queryFn: () => clientsService.getDetaileClient(Number(clientId)),
    enabled: active && reviewOpened && Number(clientId) > 0 && !cachedClient,
  });
  const clientName = cachedClient?.name ?? clientDetail.data?.client.name;
  const clientPhone = cachedClient?.phone ?? clientDetail.data?.client.phone;
  const whatsappConfirmed =
    cachedClient?.whatsappConfirmed ??
    clientDetail.data?.client.whatsappConfirmed ??
    false;
  const childLabel = (childId: number) =>
    (cachedClient?.children ?? clientDetail.data?.client.children)?.find(
      (child) => child.childId === childId,
    )?.name ?? `Ребёнок #${childId}`;
  const costumeLabel = (costumeId: number) => {
    const costume = queryClient.getQueryData<SelectedCostumeData>(
      costumesKeys.detail(costumeId),
    );
    return costume?.name ?? `Костюм #${costumeId}`;
  };

  if (pendingRequest) {
    const requestTotalRent = pendingRequest.orders.reduce(
      (sum, order) => sum + order.rentPrice,
      0,
    );
    const requestDepositLabel =
      pendingRequest.deposit.type === "cash"
        ? `Деньги · ${(pendingRequest.deposit.amount ?? 0).toLocaleString("ru-RU")} ₸`
        : pendingRequest.deposit.type === "document"
          ? "Документ"
          : "Без залога";
    return (
      <Paper withBorder p="md" radius="md" bg="orange.0">
        <Stack>
          <Text fw={700}>Выдача ещё не подтверждена</Text>
          <Text>Код визита: {pendingRequest.visitCode}</Text>
          <Text>
            Клиент #{pendingRequest.clientId} ·{" "}
            {formatVisitDate(pendingRequest.startDateTime)}{" "}
            {pendingRequest.issueTimeFrom}
          </Text>
          <Text>
            Возврат: {formatVisitDate(pendingRequest.endDateTime)} до{" "}
            {pendingRequest.returnTimeUntil}
          </Text>
          <Divider />
          {pendingRequest.orders.map((order, index) => (
            <Text
              key={`${order.childId}-${order.costumeId}-${index}`}
              size="sm"
            >
              {childLabel(order.childId)} — {costumeLabel(order.costumeId)} ·{" "}
              {order.rentPrice.toLocaleString("ru-RU")} ₸
            </Text>
          ))}
          <Text fw={600}>
            Итого аренда: {requestTotalRent.toLocaleString("ru-RU")} ₸
          </Text>
          <Text>
            Получено сейчас:{" "}
            {pendingRequest.additionalPayment.toLocaleString("ru-RU")} ₸ ·
            залог: {requestDepositLabel}
          </Text>
          <Text size="sm">
            Состав и сумма заблокированы до выяснения результата. Повторная
            отправка использует ту же команду.
          </Text>
          <Button
            loading={quickIssue.isPending}
            onClick={() => void runCommand(pendingRequest)}
          >
            Повторить выдачу
          </Button>
        </Stack>
      </Paper>
    );
  }

  if (!active) return null;

  return (
    <Stack ref={rootRef}>
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={700}>Срок аренды</Text>
            <Badge color="blue" variant="light">
              Выдача сегодня
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Stack gap={0} data-quick-field="endDateTime">
              <SmartDateInput
                label="Дата возврата"
                value={form.values.endDateTime}
                onChange={(value) => {
                  form.setFieldValue("endDateTime", value ?? "");
                  void queryClient.invalidateQueries({
                    queryKey: ["costumes", "list", "search"],
                  });
                }}
                minDate={form.values.startDateTime}
                error={form.errors.endDateTime}
              />
            </Stack>
            <Stack gap={0} data-quick-field="returnTimeUntil">
              <TimeInput
                label="Вернуть до"
                value={form.values.returnTimeUntil}
                onChange={(event) => {
                  form.setFieldValue(
                    "returnTimeUntil",
                    event.currentTarget.value,
                  );
                  void queryClient.invalidateQueries({
                    queryKey: ["costumes", "list", "search"],
                  });
                }}
                error={form.errors.returnTimeUntil}
              />
            </Stack>
          </SimpleGrid>
        </Stack>
      </Paper>

      <Stack gap="md">
        <Divider label={<Text fw={700}>Заказы</Text>} labelPosition="center" />
        {orders.map((order, index) => (
          <Paper
            key={index}
            withBorder
            p="md"
            radius="md"
            data-quick-field={`orders.${index}`}
          >
            <Group justify="space-between" mb="xs">
              <Text fw={600}>Заказ №{index + 1}</Text>
              {orders.length > 1 && (
                <ActionIcon
                  aria-label={`Удалить заказ ${index + 1}`}
                  color="red"
                  variant="subtle"
                  disabled={locked}
                  onClick={() => removeOrder(index)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              )}
            </Group>
            <Divider variant="dashed" mb="md" />
            <OrderSelectionFields
              clientId={Number(clientId) || null}
              value={{ ...order, rentPrice: order.rentPrice ?? "" }}
              onChange={(value) => {
                const rentPrice =
                  typeof value.rentPrice === "number" &&
                  Number.isFinite(value.rentPrice)
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
        <Button
          variant="outline"
          leftSection={<IconPlus size={18} />}
          onClick={addOrder}
          disabled={locked || !clientId}
          fullWidth
        >
          Добавить еще заказ
        </Button>
      </Stack>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          {prepaymentTotal > 0 && (
            <Text size="sm" c="orange.9">
              Предоплата из черновика брони не переносится.
            </Text>
          )}
          <Text fw={600}>
            Итого аренда: {totalRent.toLocaleString("ru-RU")} ₸
          </Text>
        </Stack>
      </Paper>

      {validationMessages.length > 0 && (
        <Alert color="red" title="Проверьте данные выдачи" role="alert">
          {validationMessages.map((message, index) => (
            <Text key={index} size="sm">
              {message}
            </Text>
          ))}
        </Alert>
      )}
      <Button
        size="lg"
        onClick={() => void handleReview()}
        loading={previewCode.isPending}
        disabled={locked}
      >
        Проверить и выдать
      </Button>

      <Modal
        opened={reviewOpened}
        onClose={() => {
          if (!locked) setReviewOpened(false);
        }}
        title={<Text fw={700}>Выдать сейчас · #{form.values.visitCode}</Text>}
        size="lg"
        centered
        fullScreen={isMobile}
        closeOnEscape={!locked}
        closeOnClickOutside={!locked}
      >
        <Stack gap="md">
          <Group grow align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                Клиент
              </Text>
              <Text fw={600} size="lg">
                {clientName ?? `Клиент #${clientId}`}
              </Text>
              {clientPhone ? (
                <>
                  <Text>{clientPhone}</Text>
                  <WhatsappAvailabilityNotice
                    clientId={Number(clientId)}
                    phone={clientPhone}
                    whatsappConfirmed={whatsappConfirmed}
                  />
                </>
              ) : (
                <Text size="sm" c="dimmed">
                  {clientDetail.isFetching
                    ? "Загружаем номер клиента…"
                    : "Не удалось загрузить номер клиента"}
                </Text>
              )}
            </Stack>
            <Stack gap={4}>
              <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                Аренда
              </Text>
              <Text fw={600}>Выдача: сейчас</Text>
              <Text>
                Возврат: {formatVisitDate(form.values.endDateTime)} до{" "}
                {form.values.returnTimeUntil}
              </Text>
            </Stack>
          </Group>
          <Divider label="Заказы" labelPosition="center" />
          {orders.map((order, index) => (
            <IssueOrderCard
              key={index}
              childName={childLabel(order.childId ?? 0)}
              costumeName={costumeLabel(order.costumeId ?? 0)}
              inventoryCode={
                queryClient.getQueryData<SelectedCostumeData>(
                  costumesKeys.detail(order.costumeId ?? 0),
                )?.inventoryCode
              }
              rentPrice={order.rentPrice ?? 0}
            />
          ))}
          <IssuePaymentFields
            remainingToPay={totalRent}
            totalLabel="Итого к оплате:"
            paymentLabel="Получено сейчас"
            payment={actualPayment}
            onPaymentChange={setManualPayment}
            depositType={form.values.deposit.type}
            onDepositTypeChange={(type) => {
              form.setFieldValue("deposit.type", type);
              form.clearFieldError("deposit.amount");
            }}
            depositAmount={form.values.deposit.amount ?? ""}
            onDepositAmountChange={(value) =>
              form.setFieldValue(
                "deposit.amount",
                typeof value === "number" ? value : undefined,
              )
            }
            paymentError={form.errors.additionalPayment}
            depositError={form.errors["deposit.amount"]}
            isMobile={isMobile}
            disabled={locked}
          />
          <Textarea
            label="Комментарий к выдаче"
            placeholder="Например: доплатят завтра, костюм без головного убора..."
            minRows={2}
            size="md"
            value={notes}
            onChange={(event) => onNotesChange(event.currentTarget.value)}
            disabled={locked}
          />
          {validationMessages.length > 0 && (
            <Alert color="red" title="Проверьте данные выдачи" role="alert">
              {validationMessages.map((message, index) => (
                <Text key={index} size="sm">
                  {message}
                </Text>
              ))}
            </Alert>
          )}
          {reviewError && (
            <Alert color="red" role="alert">
              {reviewError}
            </Alert>
          )}
          <Stack gap="sm" mt="md">
            <IssueSubmitButton
              type="button"
              onClick={() => void handleConfirm()}
              loading={quickIssue.isPending}
              disabled={locked}
            />
            <Button
              fullWidth
              variant="default"
              onClick={() => {
                setReviewOpened(false);
                setValidationMessages([]);
              }}
              disabled={locked}
            >
              Назад
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </Stack>
  );
}
