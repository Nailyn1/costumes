import {
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
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { VisitCancelRequestSchema, type visitCancelRequestDto } from "@costumes/shared";
import { VisitHistory } from "src/features/visits/components/history/VisitHistory";
import { IssueModal } from "src/features/visits/components/issuePage/IssueModal";
import { MarkDepositModal } from "src/features/visits/components/returnPage/MarkDepositModal";
import { ReturnModal } from "src/features/visits/components/returnPage/ReturnModal";
import { SettleBalanceModal } from "src/features/visits/components/returnPage/SettleBalanceModal";
import { useCancelVisit, useVisitForIssue, useVisitForReturn } from "src/features/visits/hooks/useVisits";
import { useVisitReadDetail } from "src/features/visits/hooks/useVisitReads";
import {
  formatVisitDate,
  formatVisitDateTime,
  formatVisitMoney,
  visitStatusLabels,
} from "src/features/visits/utils/visitReadFormatters";

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
  const { visitId: visitIdParam } = useParams();
  const parsedId = Number(visitIdParam);
  const visitId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [issueOpened, setIssueOpened] = useState(false);
  const [returnOpened, setReturnOpened] = useState(false);
  const [settleOpened, setSettleOpened] = useState(false);
  const [depositOpened, setDepositOpened] = useState(false);
  const [cancelOpened, setCancelOpened] = useState(false);
  const cancelMutation = useCancelVisit();
  const cancelForm = useForm<visitCancelRequestDto>({
    initialValues: { reason: "" },
    validate: schemaResolver(VisitCancelRequestSchema),
  });
  const detailQuery = useVisitReadDetail(visitId);
  const issueQuery = useVisitForIssue(issueOpened ? visitId : null);
  const returnQuery = useVisitForReturn(returnOpened ? visitId : null);
  const visit = detailQuery.data;

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
            <Button fullWidth={isMobile} onClick={() => setIssueOpened(true)}>Выдать костюмы</Button>
            <Button fullWidth={isMobile} variant="light" color="red" onClick={() => setCancelOpened(true)}>Отменить визит</Button>
          </Group>
        )}
        {visit.status === "issued" && <Button fullWidth={isMobile} color="green" onClick={() => setReturnOpened(true)}>Оформить возврат</Button>}
      </Group>

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
                <Text size="sm">Бирка: {order.tagStatus === "written" ? "Записана" : "Не записана"} · заказ: {orderStatusLabel(order.status)}</Text>
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
                  <Table.Td><Text size="sm">{orderStatusLabel(order.status)}</Text><Text size="xs" c="dimmed">Бирка: {order.tagStatus === "written" ? "записана" : "не записана"}</Text></Table.Td>
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
