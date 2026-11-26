import {
  Alert,
  Button,
  Center,
  Group,
  Modal,
  Loader,
  Paper,
  Stack,
  Textarea,
  Text,
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { VisitSummary, VisitCostumeCard } from "./VisitSummary";
import { VisitActionsMenu, type VisitMenuAction } from "./VisitActionsMenu";
import { IssueModal } from "src/features/visits/components/issuePage/IssueModal";
import { MarkDepositModal } from "src/features/visits/components/returnPage/MarkDepositModal";
import { ReturnModal } from "src/features/visits/components/returnPage/ReturnModal";
import { SettleBalanceModal } from "src/features/visits/components/returnPage/SettleBalanceModal";
import {
  useCancelVisit,
  useVisitForIssue,
  useVisitForReturn,
} from "src/features/visits/hooks/useVisits";
import { useAddAndIssueVisit } from "src/features/visits/hooks/useAddAndIssueVisit";
import {
  useUpdateReservedVisit,
  useVisitReadDetail,
} from "src/features/visits/hooks/useVisitReads";
import { formatVisitMoney } from "src/features/visits/utils/visitReadFormatters";
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

export function VisitDetailPage() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const userLogin = useAuthStore((state) => state.user?.login ?? null);
  const [nestedOpened, setNestedOpened] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const id = Number(visitId);
  const detail = useVisitReadDetail(Number.isInteger(id) && id > 0 ? id : null);
  return (
    <Modal
      opened
      onClose={() => navigate("/bookings/visits")}
      title={
        detail.data
          ? `${detail.data.client.name} · #${detail.data.visitCode}`
          : "Визит"
      }
      size="lg"
      fullScreen={isMobile}
      trapFocus={!nestedOpened}
      closeOnEscape={!nestedOpened}
      closeOnClickOutside={!nestedOpened}
      withCloseButton={!nestedOpened}
      closeButtonProps={{ "aria-label": "Закрыть визит" }}
    >
      <VisitDetailContent
        key={`${userLogin ?? "signed-out"}:${visitId ?? "invalid"}`}
        userLogin={userLogin}
        onNestedChange={setNestedOpened}
      />
    </Modal>
  );
}

function VisitDetailContent({
  userLogin,
  onNestedChange,
}: {
  userLogin: string | null;
  onNestedChange: (opened: boolean) => void;
}) {
  const { visitId: visitIdParam } = useParams();
  const parsedId = Number(visitIdParam);
  const visitId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [issueOpened, setIssueOpened] = useState(false);
  const [returnOpened, setReturnOpened] = useState(false);
  const [settleOpened, setSettleOpened] = useState(false);
  const [depositOpened, setDepositOpened] = useState(false);
  const [cancelOpened, setCancelOpened] = useState(false);
  const [pendingAddIssuedRequest, setPendingAddIssuedRequest] =
    useState<AddAndIssueVisitRequestDto | null>(() =>
      visitId === null ? null : getPendingAddIssuedRequest(userLogin, visitId),
    );
  const [addIssuedOpened, setAddIssuedOpened] = useState(() =>
    Boolean(pendingAddIssuedRequest),
  );
  const [addIssuedSourceVisit, setAddIssuedSourceVisit] =
    useState<VisitReadDetailDto | null>(null);
  const [addIssuedStaleSnapshot, setAddIssuedStaleSnapshot] = useState<{
    currentVersion: number | null;
  } | null>(null);
  const [addIssuedError, setAddIssuedError] = useState<string | null>(null);
  const [pendingEditRequest, setPendingEditRequest] =
    useState<UpdateReservedVisitRequestDto | null>(() =>
      visitId === null ? null : getPendingVisitEditRequest(userLogin, visitId),
    );
  const [editOpened, setEditOpened] = useState(() =>
    Boolean(pendingEditRequest),
  );
  const [editSourceVisit, setEditSourceVisit] =
    useState<VisitReadDetailDto | null>(null);
  const [editVersionConflict, setEditVersionConflict] = useState(false);
  const [editExpectedVersion, setEditExpectedVersion] = useState<number | null>(
    null,
  );
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
  useEffect(() => {
    onNestedChange(
      issueOpened ||
        returnOpened ||
        settleOpened ||
        depositOpened ||
        cancelOpened ||
        addIssuedOpened ||
        editOpened,
    );
  }, [
    onNestedChange,
    issueOpened,
    returnOpened,
    settleOpened,
    depositOpened,
    cancelOpened,
    addIssuedOpened,
    editOpened,
  ]);

  const runEditCommand = async (
    request: UpdateReservedVisitRequestDto,
    alreadyPersisted = false,
  ) => {
    if (visitId === null) return;
    if (
      !alreadyPersisted &&
      !savePendingVisitEditRequest(userLogin, visitId, request)
    ) {
      setEditErrorMessage(
        "Не удалось сохранить команду для безопасного повтора. Разрешите хранение данных сеанса и повторите сохранение.",
      );
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
      setEditErrorMessage(
        "Откройте редактирование заново, чтобы загрузить актуальную версию визита.",
      );
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
      setEditErrorMessage(
        "Не удалось обновить визит. Ваша форма сохранена; попробуйте обновить ещё раз.",
      );
      return;
    }
    if (refreshed.data.status !== "reserved") {
      setEditErrorMessage(
        "Визит уже не находится в статусе брони. Изменения не отправлены.",
      );
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
    if (
      !alreadyPersisted &&
      !savePendingAddIssuedRequest(userLogin, visitId, request)
    ) {
      setAddIssuedError(
        "Не удалось сохранить команду для безопасного повтора. Разрешите хранение данных сеанса и повторите выдачу.",
      );
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
        setAddIssuedError(
          "Результат выдачи пока неизвестен. Повторите отправку этой же команды.",
        );
        return;
      }
      clearPendingAddIssuedRequest(userLogin, visitId);
      setPendingAddIssuedRequest(null);
      setAddIssuedError(
        "Не удалось добавить костюм. Проверьте данные визита и повторите попытку.",
      );
    }
  };

  const openAddIssuedDraft = () => {
    if (
      !visit ||
      visit.status !== "issued" ||
      pendingAddIssuedRequest ||
      addIssuedMutation.isPending
    )
      return;
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
      setAddIssuedError(
        "Проверьте состав заказов, стоимость и полученную сумму.",
      );
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
      setAddIssuedError(
        "Не удалось обновить визит. Черновик сохранён; попробуйте обновить ещё раз.",
      );
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
    return (
      <Paper withBorder p="lg">
        <Text c="red">Некорректный номер визита.</Text>
      </Paper>
    );
  }

  if (detailQuery.isLoading)
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  if (detailQuery.isError || !visit) {
    return (
      <Paper withBorder p="lg">
        <Stack>
          <Text c="red">Не удалось загрузить визит.</Text>
          <Group>
            <Button variant="light" onClick={() => void detailQuery.refetch()}>
              Повторить
            </Button>
            <Button component={Link} to="/bookings/visits" variant="subtle">
              К списку визитов
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  }

  const hasUnreturnedDeposit = visit.deposits.some(
    (deposit) => deposit.type !== "none" && !deposit.returned,
  );
  const canSettle =
    visit.status === "completed" &&
    Boolean(
      visit.balance && (visit.balance.debt > 0 || visit.balance.refundDue > 0),
    );
  const canReturnDeposit = visit.status === "completed" && hasUnreturnedDeposit;
  const actions: VisitMenuAction[] =
    visit.status === "reserved"
      ? [
          { label: "Редактировать бронь", onClick: openVisitEdit },
          { label: "Выдать костюмы", onClick: () => setIssueOpened(true) },
          {
            label: "Отменить визит",
            onClick: () => setCancelOpened(true),
            color: "red",
          },
        ]
      : visit.status === "issued"
        ? [
            {
              label: "Добавить и выдать",
              onClick: openAddIssuedDraft,
              disabled:
                Boolean(pendingAddIssuedRequest) || addIssuedMutation.isPending,
            },
            { label: "Оформить возврат", onClick: () => setReturnOpened(true) },
          ]
        : [];
  if (canSettle)
    actions.push({
      label: "Записать расчёт",
      onClick: () => setSettleOpened(true),
    });
  if (canReturnDeposit)
    actions.push({
      label: "Отметить возврат залога",
      onClick: () => setDepositOpened(true),
    });

  return (
    <Stack gap="md">
      <VisitSummary
        visit={visit}
        actions={<VisitActionsMenu actions={actions} />}
      />
      {pendingAddIssuedRequest && !addIssuedOpened && (
        <Alert color="orange" title="Результат выдачи ещё не подтверждён">
          <Stack gap="xs">
            <Text size="sm">
              Сохранённая команда содержит{" "}
              {pendingAddIssuedRequest.orders.length} заказ(а/ов) на аренду{" "}
              {formatVisitMoney(
                pendingAddIssuedRequest.orders.reduce(
                  (total, order) => total + order.rentPrice,
                  0,
                ),
              )}
              ; получено сейчас{" "}
              {formatVisitMoney(pendingAddIssuedRequest.additionalPayment)}.
            </Text>
            <Text size="sm">
              Повторная отправка использует то же тело запроса и идентификатор
              команды.
            </Text>
            {addIssuedError && (
              <Text size="sm" c="red">
                {addIssuedError}
              </Text>
            )}
            <Button
              variant="default"
              onClick={openSavedAddIssuedCommand}
              disabled={addIssuedMutation.isPending}
              w={{ base: "100%", sm: "fit-content" }}
            >
              Открыть сохранённую команду
            </Button>
            <Button
              loading={addIssuedMutation.isPending}
              onClick={retryPendingAddIssued}
              w={{ base: "100%", sm: "fit-content" }}
            >
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

      <Stack gap="xs">
        <Text fw={600}>Состав визита · {visit.orders.length}</Text>
        {visit.orders.map((order) => (
          <VisitCostumeCard key={order.orderId} order={order} />
        ))}
      </Stack>
      <Text fw={600}>История визита</Text>
      <VisitHistory visitId={visit.id} visit={visit} />

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

      <IssueModal
        opened={issueOpened}
        onClose={() => setIssueOpened(false)}
        visitId={visitId}
        isMobile={isMobile}
        data={issueQuery.data}
        isLoading={issueQuery.isLoading}
        isError={issueQuery.isError}
      />
      <ReturnModal
        opened={returnOpened}
        onClose={() => setReturnOpened(false)}
        visitId={visitId}
        isMobile={isMobile}
        data={returnQuery.data}
        isLoading={returnQuery.isLoading}
        isError={returnQuery.isError}
      />
      <Modal
        opened={cancelOpened}
        onClose={() => {
          setCancelOpened(false);
          cancelForm.reset();
        }}
        title="Отменить визит"
        fullScreen={isMobile}
        centered
      >
        <form
          onSubmit={cancelForm.onSubmit((data) =>
            cancelMutation.mutate(
              { visitId, data },
              {
                onSuccess: () => {
                  setCancelOpened(false);
                  cancelForm.reset();
                },
              },
            ),
          )}
        >
          <Stack>
            <Text>Визит будет отменён. Причину можно указать по желанию.</Text>
            <Textarea
              label="Причина отмены (необязательно)"
              minRows={2}
              {...cancelForm.getInputProps("reason")}
            />
            <Group grow>
              <Button
                variant="default"
                type="button"
                onClick={() => {
                  setCancelOpened(false);
                  cancelForm.reset();
                }}
                disabled={cancelMutation.isPending}
              >
                Назад
              </Button>
              <Button
                color="red"
                type="submit"
                loading={cancelMutation.isPending}
              >
                Отменить визит
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <SettleBalanceModal
        visitId={settleOpened ? visitId : null}
        visitCode={visit.visitCode}
        onClose={() => setSettleOpened(false)}
      />
      <MarkDepositModal
        opened={depositOpened}
        onClose={() => setDepositOpened(false)}
        visitId={visitId}
        clientName={visit.client.name}
      />
    </Stack>
  );
}
