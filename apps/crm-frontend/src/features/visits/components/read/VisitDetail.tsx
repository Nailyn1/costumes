import {
  Alert,
  Anchor,
  Badge,
  Button,
  Center,
  Divider,
  Group,
  Modal,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Textarea,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AddAndIssueVisitRequestSchema,
  type AddAndIssueVisitRequestDto,
  VisitCancelRequestSchema,
  type UpdateReservedVisitRequestDto,
  type VisitReadDetailDto,
  type visitCancelRequestDto,
} from "@costumes/shared";
import { VisitEditModal } from "src/features/visits/components/edit/VisitEditModal";
import type { VisitEditDraft } from "src/features/visits/components/edit/visitEditDraft";
import { VisitHistory } from "src/features/visits/components/history/VisitHistory";
import { AddIssuedDraftModal } from "src/features/visits/components/add-issued/AddIssuedDraftModal";
import { OrderTagStatusBadge } from "src/features/visits/components/OrderTagStatusBadge";
import { IssueModal } from "src/features/visits/components/issuePage/IssueModal";
import { MarkDepositModal } from "src/features/visits/components/returnPage/MarkDepositModal";
import { ReturnModal } from "src/features/visits/components/returnPage/ReturnModal";
import { SettleBalanceModal } from "src/features/visits/components/returnPage/SettleBalanceModal";
import { useCancelVisit, useVisitForIssue, useVisitForReturn } from "src/features/visits/hooks/useVisits";
import { useAddAndIssueVisit } from "src/features/visits/hooks/useAddAndIssueVisit";
import { useUpdateReservedVisit, useVisitReadDetail } from "src/features/visits/hooks/useVisitReads";
import {
  formatVisitDate,
  formatVisitDateTime,
  formatVisitMoney,
  visitStatusLabels,
} from "src/features/visits/utils/visitReadFormatters";
import { createUpdateReservedVisitRequest } from "src/features/visits/components/edit/visitEditDraft";
import { useAuthStore } from "src/stores/auth.store";
import {
  clearPendingVisitEditRequest,
  getPendingVisitEditRequest,
  savePendingVisitEditRequest,
} from "src/features/visits/utils/visitEditRequestStorage";
import {
  isAmbiguousVisitEditFailure,
  isVisitVersionConflict,
  visitEditFailureMessage,
} from "src/features/visits/utils/visitEditRequestFailure";
import {
  isAmbiguousAddIssuedFailure,
  isStaleVisitVersionConflict,
} from "src/features/visits/components/add-issued/addIssuedFailures";
import {
  clearPendingAddIssuedRequest,
  getPendingAddIssuedRequest,
  savePendingAddIssuedRequest,
} from "src/features/visits/utils/addIssuedRequestStorage";

function StatusBadge({ status }: { status: "reserved" | "issued" | "completed" | "cancelled" }) {
  const color = status === "reserved" ? "blue" : status === "issued" ? "orange" : status === "completed" ? "green" : "gray";
  return <Badge color={color}>{visitStatusLabels[status]}</Badge>;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <Stack gap={2}><Text size="xs" c="dimmed">{label}</Text><Text>{value}</Text></Stack>;
}

function depositTypeLabel(type: "cash" | "document" | "none"): string {
  if (type === "cash") return "Деньги";
  if (type === "document") return "Документ";
  return "Без залога";
}

function operationLabel(kind: "issue_payment" | "debt_payment" | "customer_refund"): string {
  if (kind === "issue_payment") return "Оплата при выдаче";
  if (kind === "debt_payment") return "Погашение долга";
  return "Возврат клиенту";
}

function orderStatusLabel(status: "reserved" | "issued" | "returned" | "cancelled"): string {
  if (status === "reserved") return "Забронирован";
  if (status === "issued") return "Выдан";
  if (status === "returned") return "Возвращён";
  return "Отменён";
}

export function VisitDetailPage() {
  const { visitId } = useParams();
  const userLogin = useAuthStore((state) => state.user?.login ?? null);
  return <VisitDetailContent key={`${userLogin ?? "signed-out"}:${visitId ?? "invalid"}`} userLogin={userLogin} />;
}

function VisitDetailContent({ userLogin }: { userLogin: string | null }) {
  const { visitId: visitIdParam } = useParams();
  const parsedId = Number(visitIdParam);
  const visitId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [issueOpened, setIssueOpened] = useState(false);
  const [returnOpened, setReturnOpened] = useState(false);
  const [settleOpened, setSettleOpened] = useState(false);
  const [depositOpened, setDepositOpened] = useState(false);
  const [cancelOpened, setCancelOpened] = useState(false);
  const [pendingAddIssuedRequest, setPendingAddIssuedRequest] = useState<AddAndIssueVisitRequestDto | null>(() =>
    visitId === null ? null : getPendingAddIssuedRequest(userLogin, visitId),
  );
  const [addIssuedOpened, setAddIssuedOpened] = useState(() => Boolean(pendingAddIssuedRequest));
  const [addIssuedSourceVisit, setAddIssuedSourceVisit] = useState<VisitReadDetailDto | null>(null);
  const [addIssuedStaleSnapshot, setAddIssuedStaleSnapshot] = useState<{ currentVersion: number | null } | null>(null);
  const [addIssuedError, setAddIssuedError] = useState<string | null>(null);
  const [pendingEditRequest, setPendingEditRequest] = useState<UpdateReservedVisitRequestDto | null>(() =>
    visitId === null ? null : getPendingVisitEditRequest(userLogin, visitId),
  );
  const [editOpened, setEditOpened] = useState(() => Boolean(pendingEditRequest));
  const [editSourceVisit, setEditSourceVisit] = useState<VisitReadDetailDto | null>(null);
  const [editVersionConflict, setEditVersionConflict] = useState(false);
  const [editExpectedVersion, setEditExpectedVersion] = useState<number | null>(null);
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);
  const updateVisitMutation = useUpdateReservedVisit();
  const addIssuedMutation = useAddAndIssueVisit();
  const cancelMutation = useCancelVisit();
  const cancelForm = useForm<visitCancelRequestDto>({
    initialValues: { reason: "" },
    validate: schemaResolver(VisitCancelRequestSchema),
  });
  const detailQuery = useVisitReadDetail(visitId);
  const issueQuery = useVisitForIssue(issueOpened ? visitId : null);
  const returnQuery = useVisitForReturn(returnOpened ? visitId : null);
  const visit = detailQuery.data;

  const runEditCommand = async (
    request: UpdateReservedVisitRequestDto,
    alreadyPersisted = false,
  ) => {
    if (visitId === null) return;
    if (!alreadyPersisted && !savePendingVisitEditRequest(userLogin, visitId, request)) {
      setEditErrorMessage("Не удалось сохранить команду для безопасного повтора. Разрешите хранение данных сеанса и повторите сохранение.");
      return;
    }
    setEditErrorMessage(null);
    try {
      await updateVisitMutation.mutateAsync({ visitId, body: request });
      clearPendingVisitEditRequest(userLogin, visitId);
      setPendingEditRequest(null);
      setEditVersionConflict(false);
      setEditExpectedVersion(null);
      setEditSourceVisit(null);
      setEditOpened(false);
    } catch (error) {
      setEditErrorMessage(visitEditFailureMessage(error));
      if (isAmbiguousVisitEditFailure(error)) {
        setPendingEditRequest(request);
        return;
      }
      clearPendingVisitEditRequest(userLogin, visitId);
      setPendingEditRequest(null);
      if (isVisitVersionConflict(error)) setEditVersionConflict(true);
    }
  };

  const handleSaveVisitEdit = async (draft: VisitEditDraft) => {
    if (visitId === null || !visit) return;
    if (editExpectedVersion === null) {
      setEditErrorMessage("Откройте редактирование заново, чтобы загрузить актуальную версию визита.");
      return;
    }
    let request: UpdateReservedVisitRequestDto;
    try {
      request = createUpdateReservedVisitRequest(
        draft,
        editExpectedVersion,
        crypto.randomUUID(),
      );
    } catch {
      setEditErrorMessage("Проверьте даты, время и состав заказа.");
      return;
    }
    await runEditCommand(request);
  };

  const retryPendingVisitEdit = () => {
    if (!pendingEditRequest) return;
    void runEditCommand(pendingEditRequest, true);
  };

  const rebaseVisitEditVersion = async () => {
    const refreshed = await detailQuery.refetch();
    if (refreshed.isError || !refreshed.data) {
      setEditErrorMessage("Не удалось обновить визит. Ваша форма сохранена; попробуйте обновить ещё раз.");
      return;
    }
    if (refreshed.data.status !== "reserved") {
      setEditErrorMessage("Визит уже не находится в статусе брони. Изменения не отправлены.");
      setEditVersionConflict(true);
      return;
    }
    setEditExpectedVersion(refreshed.data.version);
    setEditVersionConflict(false);
    setEditErrorMessage(null);
    notifications.show({
      title: "Актуальная версия загружена",
      message: "Ваши поля сохранены. Проверьте их и сохраните ещё раз.",
      color: "blue",
    });
  };

  const openVisitEdit = () => {
    if (!visit || visit.status !== "reserved") return;
    setEditSourceVisit(visit);
    setEditExpectedVersion(visit.version);
    setEditVersionConflict(false);
    setEditErrorMessage(null);
    setEditOpened(true);
  };

  const closeVisitEdit = () => {
    if (pendingEditRequest) return;
    setEditOpened(false);
    setEditSourceVisit(null);
    setEditExpectedVersion(null);
    setEditVersionConflict(false);
    setEditErrorMessage(null);
  };

  const runAddIssuedCommand = async (
    request: AddAndIssueVisitRequestDto,
    alreadyPersisted = false,
  ) => {
    if (visitId === null) return;
    if (!alreadyPersisted && !savePendingAddIssuedRequest(userLogin, visitId, request)) {
      setAddIssuedError("Не удалось сохранить команду для безопасного повтора. Разрешите хранение данных сеанса и повторите выдачу.");
      return;
    }
    setAddIssuedError(null);
    try {
      await addIssuedMutation.mutateAsync({ visitId, body: request });
      clearPendingAddIssuedRequest(userLogin, visitId);
      setPendingAddIssuedRequest(null);
      setAddIssuedStaleSnapshot(null);
      setAddIssuedOpened(false);
      setAddIssuedSourceVisit(null);
    } catch (error) {
      if (isStaleVisitVersionConflict(error)) {
        clearPendingAddIssuedRequest(userLogin, visitId);
        setPendingAddIssuedRequest(null);
        setAddIssuedStaleSnapshot({ currentVersion: null });
        setAddIssuedError(null);
        return;
      }
      if (isAmbiguousAddIssuedFailure(error)) {
        setPendingAddIssuedRequest(request);
        setAddIssuedError("Результат выдачи пока неизвестен. Повторите отправку этой же команды.");
        return;
      }
      clearPendingAddIssuedRequest(userLogin, visitId);
      setPendingAddIssuedRequest(null);
      setAddIssuedError("Не удалось добавить костюм. Проверьте данные визита и повторите попытку.");
    }
  };

  const openAddIssuedDraft = () => {
    if (!visit || visit.status !== "issued" || pendingAddIssuedRequest || addIssuedMutation.isPending) return;
    setAddIssuedSourceVisit(visit);
    setAddIssuedError(null);
    setAddIssuedStaleSnapshot(null);
    setAddIssuedOpened(true);
  };

  const openSavedAddIssuedCommand = () => {
    if (!visit || visit.status !== "issued" || !pendingAddIssuedRequest) return;
    setAddIssuedSourceVisit(visit);
    setAddIssuedError(null);
    setAddIssuedOpened(true);
  };

  const submitAddIssuedDraft = (request: AddAndIssueVisitRequestDto) => {
    const parsed = AddAndIssueVisitRequestSchema.safeParse(request);
    if (!parsed.success) {
      setAddIssuedError("Проверьте состав заказов, стоимость и полученную сумму.");
      return;
    }
    void runAddIssuedCommand(parsed.data);
  };

  const retryPendingAddIssued = () => {
    if (!pendingAddIssuedRequest) return;
    void runAddIssuedCommand(pendingAddIssuedRequest, true);
  };

  const rebaseAddIssuedDraft = async (): Promise<VisitReadDetailDto> => {
    const refreshed = await detailQuery.refetch();
    if (refreshed.isError || !refreshed.data) {
      setAddIssuedError("Не удалось обновить визит. Черновик сохранён; попробуйте обновить ещё раз.");
      throw new Error("Не удалось обновить визит");
    }
    if (refreshed.data.status !== "issued") {
      setAddIssuedError("Визит уже не выдан. Добавить костюм в него нельзя.");
      throw new Error("Визит больше не выдан");
    }
    setAddIssuedStaleSnapshot(null);
    setAddIssuedError(null);
    setAddIssuedSourceVisit(refreshed.data);
    return refreshed.data;
  };

  const closeAddIssuedDraft = () => {
    if (addIssuedMutation.isPending || pendingAddIssuedRequest) return;
    setAddIssuedOpened(false);
    setAddIssuedSourceVisit(null);
    setAddIssuedStaleSnapshot(null);
    setAddIssuedError(null);
  };

  if (visitId === null) {
    return <Paper withBorder p="lg"><Text c="red">Некорректный номер визита.</Text></Paper>;
  }

  if (detailQuery.isLoading) return <Center p="xl"><Loader /></Center>;
  if (detailQuery.isError || !visit) {
    return (
      <Paper withBorder p="lg">
        <Stack>
          <Text c="red">Не удалось загрузить визит.</Text>
          <Group><Button variant="light" onClick={() => void detailQuery.refetch()}>Повторить</Button><Button component={Link} to="/bookings/visits" variant="subtle">К списку визитов</Button></Group>
        </Stack>
      </Paper>
    );
  }

  const hasUnreturnedDeposit = visit.deposits.some((deposit) => deposit.type !== "none" && !deposit.returned);
  const canSettle = visit.status === "completed" && Boolean(visit.balance && (visit.balance.debt > 0 || visit.balance.refundDue > 0));
  const canReturnDeposit = visit.status === "completed" && hasUnreturnedDeposit;
  const rentDates = `${formatVisitDate(visit.startDateTime)} — ${formatVisitDate(visit.endDateTime)}`;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Anchor component={Link} to="/bookings/visits" size="sm">← Все визиты</Anchor>
          <Group><Title order={2}>Визит #{visit.visitCode}</Title><StatusBadge status={visit.status} /></Group>
        </Stack>
        {visit.status === "reserved" && (
          <Group grow={isMobile}>
            <Button fullWidth={isMobile} variant="light" onClick={openVisitEdit}>Редактировать бронь</Button>
            <Button fullWidth={isMobile} onClick={() => setIssueOpened(true)}>Выдать костюмы</Button>
            <Button fullWidth={isMobile} variant="light" color="red" onClick={() => setCancelOpened(true)}>Отменить визит</Button>
          </Group>
        )}
        {visit.status === "issued" && (
          <Group grow={isMobile}>
            <Button fullWidth={isMobile} variant="light" onClick={openAddIssuedDraft} disabled={Boolean(pendingAddIssuedRequest) || addIssuedMutation.isPending}>
              Добавить и выдать
            </Button>
            <Button fullWidth={isMobile} color="green" onClick={() => setReturnOpened(true)}>Оформить возврат</Button>
          </Group>
        )}
      </Group>

      {pendingAddIssuedRequest && !addIssuedOpened && (
        <Alert color="orange" title="Результат выдачи ещё не подтверждён">
          <Stack gap="xs">
            <Text size="sm">
              Сохранённая команда содержит {pendingAddIssuedRequest.orders.length} заказ(а/ов) на аренду {formatVisitMoney(
                pendingAddIssuedRequest.orders.reduce((total, order) => total + order.rentPrice, 0),
              )}; получено сейчас {formatVisitMoney(pendingAddIssuedRequest.additionalPayment)}.
            </Text>
            <Text size="sm">Повторная отправка использует то же тело запроса и идентификатор команды.</Text>
            {addIssuedError && <Text size="sm" c="red">{addIssuedError}</Text>}
            <Button variant="default" onClick={openSavedAddIssuedCommand} disabled={addIssuedMutation.isPending} w={{ base: "100%", sm: "fit-content" }}>
              Открыть сохранённую команду
            </Button>
            <Button loading={addIssuedMutation.isPending} onClick={retryPendingAddIssued} w={{ base: "100%", sm: "fit-content" }}>
              Повторить выдачу
            </Button>
          </Stack>
        </Alert>
      )}
      {!addIssuedOpened && !pendingAddIssuedRequest && addIssuedError && (
        <Alert color="red" title="Не удалось добавить костюм">
          {addIssuedError}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Title order={4}>Клиент и сроки</Title>
            <KeyValue label="Клиент" value={visit.client.name} />
            <KeyValue label="Телефон" value={visit.client.phone} />
            <KeyValue label="Срок аренды" value={rentDates} />
            <KeyValue label="Окно выдачи" value={`${visit.issueTimeFrom}–${visit.issueTimeTo}`} />
            <KeyValue label="Вернуть до" value={`${formatVisitDate(visit.endDateTime)}, ${visit.returnTimeUntil}`} />
            <KeyValue label="Создан" value={formatVisitDateTime(visit.createdAt)} />
            {visit.notes && <KeyValue label="Заметки" value={visit.notes} />}
          </Stack>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Title order={4}>Суммы</Title>
            <KeyValue label="Аренда" value={formatVisitMoney(visit.totals.totalRent)} />
            <KeyValue label="Предоплата" value={formatVisitMoney(visit.totals.totalPrepayment)} />
            {visit.status === "reserved" && <KeyValue label="К доплате при выдаче" value={formatVisitMoney(visit.totals.totalRemaining)} />}
            {visit.balance && (
              <>
                <Divider />
                <KeyValue label="Получено по операциям" value={formatVisitMoney(visit.balance.totalReceived)} />
                <KeyValue label="Возвращено клиенту" value={formatVisitMoney(visit.balance.totalRefunded)} />
                <KeyValue label="Долг" value={formatVisitMoney(visit.balance.debt)} />
                <KeyValue label="К возврату" value={formatVisitMoney(visit.balance.refundDue)} />
              </>
            )}
            {canSettle && <Button variant="light" onClick={() => setSettleOpened(true)}>Записать расчёт</Button>}
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Title order={4}>Состав визита · {visit.orders.length}</Title>
          {isMobile ? visit.orders.map((order) => (
            <Paper key={order.orderId} withBorder p="sm" radius="sm">
              <Stack gap={4}>
                <Text fw={600}>{order.costumeName}</Text>
                <Text size="sm">Ребёнок: {order.childName}</Text>
                <Group gap="xs"><OrderTagStatusBadge tagStatus={order.tagStatus} /><Text size="sm">Заказ: {orderStatusLabel(order.status)}</Text></Group>
                <Text size="sm">Аренда: {formatVisitMoney(order.rentPrice)} · предоплата: {formatVisitMoney(order.prepaymentAmount)}</Text>
                {order.notes && <Text size="sm" c="dimmed">{order.notes}</Text>}
              </Stack>
            </Paper>
          )) : (
            <Table.ScrollContainer minWidth={900}>
              <Table highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Ребёнок</Table.Th><Table.Th>Костюм</Table.Th><Table.Th>Статусы</Table.Th><Table.Th>Аренда</Table.Th><Table.Th>Предоплата</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>{visit.orders.map((order) => <Table.Tr key={order.orderId}>
                  <Table.Td>{order.childName}</Table.Td>
                  <Table.Td>{order.costumeName}<Text size="xs" c="dimmed">{order.inventoryCode}</Text></Table.Td>
                  <Table.Td><Stack gap={4}><Text size="sm">{orderStatusLabel(order.status)}</Text><OrderTagStatusBadge tagStatus={order.tagStatus} /></Stack></Table.Td>
                  <Table.Td>{formatVisitMoney(order.rentPrice)}</Table.Td>
                  <Table.Td>{formatVisitMoney(order.prepaymentAmount)}</Table.Td>
                </Table.Tr>)}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between"><Title order={4}>Залоги</Title>{canReturnDeposit && <Button variant="light" onClick={() => setDepositOpened(true)}>Отметить возврат залога</Button>}</Group>
          {visit.deposits.length === 0 ? <Text c="dimmed">Активных залогов нет</Text> : visit.deposits.map((deposit) => (
            <Group key={deposit.id} justify="space-between" wrap="nowrap">
              <Text>{depositTypeLabel(deposit.type)}{deposit.type === "cash" && deposit.amount !== undefined ? ` · ${formatVisitMoney(deposit.amount)}` : ""}</Text>
              <Badge color={deposit.returned || deposit.type === "none" ? "gray" : "orange"}>{deposit.type === "none" ? "Не применялся" : deposit.returned ? "Возвращён" : "Удерживается"}</Badge>
            </Group>
          ))}
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Title order={4}>Денежные операции</Title>
          {visit.moneyOperations.length === 0 ? <Text c="dimmed">Операций пока нет</Text> : visit.moneyOperations.map((operation) => (
            <Group key={operation.id} justify="space-between" wrap="nowrap">
              <Stack gap={2}>
                <Text>{operationLabel(operation.kind)}</Text>
                <Text size="xs" c="dimmed">
                  {operation.legacyImported
                    ? "Импортировано из прошлых данных; дата операции неизвестна"
                    : formatVisitDateTime(operation.createdAt)}
                </Text>
              </Stack>
              <Stack gap={2} align="flex-end"><Text fw={600}>{formatVisitMoney(operation.amount)}</Text>{operation.voidedAt && <Badge color="gray">Аннулирована</Badge>}</Stack>
            </Group>
          ))}
        </Stack>
      </Paper>

      <VisitHistory visitId={visit.id} />

      <VisitEditModal
        opened={editOpened}
        onClose={closeVisitEdit}
        visit={editSourceVisit ?? visit}
        isMobile={isMobile}
        onSave={handleSaveVisitEdit}
        isSaving={updateVisitMutation.isPending}
        errorMessage={editErrorMessage}
        pendingRequest={pendingEditRequest}
        onRetryPending={retryPendingVisitEdit}
        versionConflict={editVersionConflict}
        onRebaseVersion={rebaseVisitEditVersion}
      />

      <AddIssuedDraftModal
        opened={addIssuedOpened}
        onClose={closeAddIssuedDraft}
        visitSnapshot={addIssuedSourceVisit ?? visit}
        onConfirm={submitAddIssuedDraft}
        pendingRequest={pendingAddIssuedRequest}
        onRetryPending={retryPendingAddIssued}
        retrying={addIssuedMutation.isPending}
        locked={addIssuedMutation.isPending || Boolean(pendingAddIssuedRequest)}
        staleSnapshot={addIssuedStaleSnapshot}
        onRebase={rebaseAddIssuedDraft}
        errorMessage={addIssuedError}
      />

      <IssueModal opened={issueOpened} onClose={() => setIssueOpened(false)} visitId={visitId} isMobile={isMobile} data={issueQuery.data} isLoading={issueQuery.isLoading} isError={issueQuery.isError} />
      <ReturnModal opened={returnOpened} onClose={() => setReturnOpened(false)} visitId={visitId} isMobile={isMobile} data={returnQuery.data} isLoading={returnQuery.isLoading} isError={returnQuery.isError} />
      <Modal opened={cancelOpened} onClose={() => { setCancelOpened(false); cancelForm.reset(); }} title="Отменить визит" fullScreen={isMobile} centered>
        <form onSubmit={cancelForm.onSubmit((data) => cancelMutation.mutate({ visitId, data }, { onSuccess: () => { setCancelOpened(false); cancelForm.reset(); } }))}>
          <Stack>
            <Text>Визит будет отменён. Причину можно указать по желанию.</Text>
            <Textarea label="Причина отмены (необязательно)" minRows={2} {...cancelForm.getInputProps("reason")} />
            <Group grow>
              <Button variant="default" type="button" onClick={() => { setCancelOpened(false); cancelForm.reset(); }} disabled={cancelMutation.isPending}>Назад</Button>
              <Button color="red" type="submit" loading={cancelMutation.isPending}>Отменить визит</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <SettleBalanceModal visitId={settleOpened ? visitId : null} visitCode={visit.visitCode} onClose={() => setSettleOpened(false)} />
      <MarkDepositModal opened={depositOpened} onClose={() => setDepositOpened(false)} visitId={visitId} clientName={visit.client.name} />
    </Stack>
  );
}
