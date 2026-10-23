import {
  AddAndIssueVisitRequestSchema,
  type AddAndIssueVisitRequestDto,
  type VisitReadDetailDto,
} from "@costumes/shared";
import {
  ActionIcon,
  Button,
  Divider,
  Fieldset,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { schemaResolver, useForm, type FormErrors } from "@mantine/form";
import { useMediaQuery } from "@mantine/hooks";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { MoneyInput } from "src/components/MoneyInput";
import { OrderSelectionFields, type OrderSelectionValue } from "../OrderSelectionFields";
import { formatVisitDate, formatVisitMoney } from "../../utils/visitReadFormatters";
import {
  calculateAddIssuedBalance,
  type AddIssuedBalancePreview,
} from "./addIssuedBalance";

interface AddIssuedDraftValues {
  orders: OrderSelectionValue[];
  receivedNow: number | string;
}

export interface AddIssuedStaleSnapshot {
  currentVersion: number | null;
}

interface AddIssuedDraftModalProps {
  opened: boolean;
  /** The detail snapshot captured when the modal opens; keep it stable until explicit rebase. */
  visitSnapshot: VisitReadDetailDto;
  onClose: () => void;
  onConfirm: (
    request: AddAndIssueVisitRequestDto,
    preview: AddIssuedBalancePreview,
  ) => void;
  pendingRequest?: AddAndIssueVisitRequestDto | null;
  onRetryPending?: () => void;
  retrying?: boolean;
  locked?: boolean;
  staleSnapshot?: AddIssuedStaleSnapshot | null;
  onRebase?: () => VisitReadDetailDto | Promise<VisitReadDetailDto>;
  errorMessage?: string | null;
}

function emptyOrder(): OrderSelectionValue {
  return { childId: null, costumeId: null, rentPrice: "", notes: "" };
}

function depositText(visit: VisitReadDetailDto): string {
  const latestDeposit = [...visit.deposits].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  )[0];
  if (!latestDeposit || latestDeposit.type === "none") return "Без залога";

  const type = latestDeposit.type === "cash" ? "Деньги" : "Документ";
  const amount = latestDeposit.type === "cash" && latestDeposit.amount !== undefined
    ? ` · ${formatVisitMoney(latestDeposit.amount)}`
    : "";
  const status = latestDeposit.returned ? " · возвращён" : " · удерживается";
  return `${type}${amount}${status}`;
}

function signedBalanceText(amount: number): string {
  if (amount > 0) return `Долг: ${formatVisitMoney(amount)}`;
  if (amount < 0) return `К возврату: ${formatVisitMoney(Math.abs(amount))}`;
  return "Баланс закрыт";
}

/** Draft-only UI for adding issued orders; the caller supplies the immutable detail snapshot. */
export function AddIssuedDraftModal({
  opened,
  visitSnapshot,
  onClose,
  onConfirm,
  pendingRequest = null,
  onRetryPending,
  retrying = false,
  locked = false,
  staleSnapshot = null,
  onRebase,
  errorMessage = null,
}: AddIssuedDraftModalProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [reviewOpened, setReviewOpened] = useState(false);
  const [snapshot, setSnapshot] = useState(visitSnapshot);
  const [expectedVersion, setExpectedVersion] = useState(visitSnapshot.version);
  const wasOpened = useRef(false);
  const validateRequest = schemaResolver(AddAndIssueVisitRequestSchema);
  const form = useForm<AddIssuedDraftValues, AddIssuedDraftValues, FormErrors | Promise<FormErrors>>({
    initialValues: pendingRequest
      ? {
          orders: pendingRequest.orders.map((order) => ({
            childId: order.childId,
            costumeId: order.costumeId,
            rentPrice: order.rentPrice,
            notes: order.notes ?? "",
          })),
          receivedNow: pendingRequest.additionalPayment,
        }
      : { orders: [emptyOrder()], receivedNow: 0 },
    validate: async (values) => {
      const errors = await validateRequest({
        commandId: "00000000-0000-4000-8000-000000000000",
        expectedVersion: Math.max(1, snapshot.version),
        orders: values.orders.map((order) => ({
          childId: Number(order.childId),
          costumeId: Number(order.costumeId),
          rentPrice: Number(order.rentPrice),
          ...(order.notes ? { notes: order.notes } : {}),
        })),
        additionalPayment: Number(values.receivedNow),
      });
      const seenCostumeIds = new Set<number>();
      values.orders.forEach((order, index) => {
        if (Number(order.childId) < 1) {
          errors[`orders.${index}.childId`] = "Выберите ребёнка";
        }
        const costumeId = Number(order.costumeId);
        if (costumeId < 1) {
          errors[`orders.${index}.costumeId`] = "Выберите костюм";
        } else if (seenCostumeIds.has(costumeId)) {
          errors[`orders.${index}.costumeId`] = "Этот костюм уже выбран выше";
        } else {
          seenCostumeIds.add(costumeId);
        }
        const rent = Number(order.rentPrice);
        if (order.rentPrice === "" || !Number.isSafeInteger(rent) || rent < 0) {
          errors[`orders.${index}.rentPrice`] = "Укажите целую сумму не меньше 0 ₸";
        }
      });
      if (errors.additionalPayment) {
        errors.receivedNow = errors.additionalPayment;
        delete errors.additionalPayment;
      }
      return errors;
    },
  });
  useEffect(() => {
    if (opened && !wasOpened.current) {
      setSnapshot(visitSnapshot);
      setExpectedVersion(pendingRequest?.expectedVersion ?? visitSnapshot.version);
      form.reset();
      setReviewOpened(false);
    }
    wasOpened.current = opened;
  }, [form, opened, pendingRequest, visitSnapshot]);
  const stale = staleSnapshot && snapshot.version !== staleSnapshot.currentVersion
    ? staleSnapshot
    : null;

  const rebase = async () => {
    if (!onRebase) return;
    try {
      const refreshed = await onRebase();
      setSnapshot(refreshed);
      setExpectedVersion(refreshed.version);
      setReviewOpened(false);
    } catch {
      // The caller displays the refresh failure while the stale draft remains intact.
    }
  };

  const currentSignedBalance = snapshot.balance?.signedBalance ?? calculateAddIssuedBalance(
    snapshot,
    [],
    0,
  ).currentSignedBalance;
  const preview = calculateAddIssuedBalance(
    snapshot,
    form.values.orders.map((order) => ({ rentPrice: Number(order.rentPrice) || 0 })),
    form.values.receivedNow,
  );
  const activeBalance = signedBalanceText(currentSignedBalance);

  const validateDraft = async (): Promise<boolean> => !(await form.validate()).hasErrors;

  const openReview = async () => {
    if (await validateDraft()) setReviewOpened(true);
  };

  const confirmDraft = async () => {
    if (!(await validateDraft())) return;
    const parsed = AddAndIssueVisitRequestSchema.safeParse({
      commandId: crypto.randomUUID(),
        expectedVersion,
      orders: form.values.orders.map((order) => ({
        childId: order.childId,
        costumeId: order.costumeId,
        rentPrice: Number(order.rentPrice),
        ...(order.notes ? { notes: order.notes } : {}),
      })),
      additionalPayment: Number(form.values.receivedNow),
    });
    if (!parsed.success) return;
    const request: AddAndIssueVisitRequestDto = parsed.data;
    setReviewOpened(false);
    onConfirm(request, preview);
  };

  const closeReview = () => setReviewOpened(false);

  return (
    <>
      <Modal
        opened={opened}
        onClose={() => {
          if (!locked) onClose();
        }}
        title={<Text fw={700}>Добавить и выдать · визит №{snapshot.visitCode}</Text>}
        size="xl"
        centered
        fullScreen={isMobile}
        closeOnEscape={!locked}
        closeOnClickOutside={!locked}
      >
        <Stack gap="md">
          <Paper withBorder p="sm" radius="sm">
            <Stack gap="xs">
              <Text size="sm">Клиент: {snapshot.client.name} · {snapshot.client.phone}</Text>
              <Text size="sm">
                Срок аренды: {formatVisitDate(snapshot.startDateTime)} — {formatVisitDate(snapshot.endDateTime)}
              </Text>
              <Text size="sm">
                Выдача: {snapshot.issueTimeFrom}–{snapshot.issueTimeTo} · вернуть до {snapshot.returnTimeUntil}
              </Text>
              <Divider />
              <Text fw={600}>Уже выдано · только для просмотра</Text>
              {snapshot.orders.map((order) => (
                <Text key={order.orderId} size="sm">
                  {order.childName} — {order.costumeName} · аренда {formatVisitMoney(order.rentPrice)}
                </Text>
              ))}
              <Divider />
              <Text size="sm">Текущий баланс: {activeBalance}</Text>
              <Text size="sm">Существующий залог: {depositText(snapshot)} · без изменений</Text>
            </Stack>
          </Paper>

          <Divider label="Новые заказы" labelPosition="center" />
          <Fieldset variant="unstyled" disabled={locked}>
            <Stack gap="md">
              {form.values.orders.map((order, index) => (
                <Paper key={index} withBorder p="sm" radius="sm">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text fw={600}>Новый заказ №{index + 1}</Text>
                      {form.values.orders.length > 1 && (
                        <ActionIcon
                          aria-label={`Удалить новый заказ ${index + 1}`}
                          color="red"
                          variant="subtle"
                          onClick={() => form.removeListItem("orders", index)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                    <OrderSelectionFields
                      clientId={snapshot.client.id}
                      value={order}
                      onChange={(value) => form.setFieldValue(`orders.${index}`, value)}
                      startDateTime={snapshot.startDateTime}
                      endDateTime={snapshot.endDateTime}
                      issueTimeFrom={snapshot.issueTimeFrom}
                      returnTimeUntil={snapshot.returnTimeUntil}
                      errors={{
                        childId: form.errors[`orders.${index}.childId`],
                        costumeId: form.errors[`orders.${index}.costumeId`],
                        rentPrice: form.errors[`orders.${index}.rentPrice`],
                      }}
                      disabled={locked}
                    />
                  </Stack>
                </Paper>
              ))}
              <Button
                variant="outline"
                leftSection={<IconPlus size={16} />}
                onClick={() => form.insertListItem("orders", emptyOrder())}
                disabled={locked}
              >
                Добавить ещё заказ
              </Button>
            </Stack>
          </Fieldset>

          <Paper withBorder p="sm" radius="sm">
            <Stack gap="xs">
              <Text fw={600}>Расчёт по всему визиту</Text>
              <Text size="sm">Визит после выдачи: аренда {formatVisitMoney(preview.totalRentAfter)}</Text>
              <Text size="sm">Предоплата: {formatVisitMoney(preview.existingPrepayment)}</Text>
              <Text size="sm">Доплаты ранее: {formatVisitMoney(preview.additionalPaymentsBefore)}</Text>
              <MoneyInput
                label="Получено сейчас"
                value={form.values.receivedNow}
                onChange={(value) => form.setFieldValue("receivedNow", value)}
                error={form.errors.receivedNow}
                disabled={locked}
              />
              <Text size="sm" fw={600}>После выдачи: {signedBalanceText(preview.signedBalanceAfter)}</Text>
              <Text size="xs" c="dimmed">Фактически принятая сумма учитывает и прежний долг или переплату. Залог не меняется.</Text>
            </Stack>
          </Paper>
          {stale && (
            <Paper withBorder p="sm" radius="sm" bg="orange.0" role="alert">
              <Stack gap="xs">
                <Text fw={600}>Визит изменился у другого сотрудника</Text>
                <Text size="sm">
                  {stale.currentVersion === null
                    ? "Загрузите актуальную версию визита. Черновик сохранён."
                    : `Ваша версия ${snapshot.version}, текущая версия ${stale.currentVersion}. Черновик сохранён.`}
                </Text>
                {onRebase && (
                  <Button variant="light" onClick={() => void rebase()} disabled={locked}>
                    Обновить версию
                  </Button>
                )}
              </Stack>
            </Paper>
          )}
          {errorMessage && <Paper withBorder p="sm" radius="sm" bg="red.0" role="alert">{errorMessage}</Paper>}
          {pendingRequest && (
            <Paper withBorder p="sm" radius="sm" bg="orange.0" role="alert">
              <Stack gap="xs">
                <Text fw={600}>Результат выдачи пока неизвестен</Text>
                <Text size="sm">Состав и сумма заблокированы до выяснения результата. Повтор отправит ту же команду.</Text>
                {onRetryPending && (
                  <Button onClick={onRetryPending} loading={retrying} disabled={retrying}>
                    Повторить выдачу
                  </Button>
                )}
              </Stack>
            </Paper>
          )}
          <Group grow>
            <Button variant="default" onClick={onClose} disabled={locked || Boolean(pendingRequest)}>Назад</Button>
            <Button onClick={() => void openReview()} disabled={locked || Boolean(stale)}>Проверить суммы</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={reviewOpened}
        onClose={() => {
          if (!locked) closeReview();
        }}
        title="Проверка дополнения"
        centered
        fullScreen={isMobile}
        closeOnEscape={!locked}
        closeOnClickOutside={!locked}
      >
        <Stack>
          <Text>Версия визита: {expectedVersion}</Text>
          <Text>Клиент: {snapshot.client.name} · {snapshot.client.phone}</Text>
          <Text>
            Срок аренды: {formatVisitDate(snapshot.startDateTime)} — {formatVisitDate(snapshot.endDateTime)}
          </Text>
          {form.values.orders.map((order, index) => (
            <Text key={`${order.childId}-${order.costumeId}-${index}`}>
              Новый заказ №{index + 1}: аренда {formatVisitMoney(Number(order.rentPrice))}
            </Text>
          ))}
          <Text>Получено сейчас: {formatVisitMoney(preview.receivedNow)}</Text>
          <Text>Итого аренда: {formatVisitMoney(preview.totalRentAfter)}</Text>
          <Text fw={700}>Итоговый баланс: {signedBalanceText(preview.signedBalanceAfter)}</Text>
          <Text size="sm">Залог: {depositText(snapshot)} · останется без изменений</Text>
          <Group grow>
            <Button variant="default" onClick={closeReview} disabled={locked}>Назад</Button>
            <Button onClick={() => void confirmDraft()} disabled={locked}>Подтвердить выдачу</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
