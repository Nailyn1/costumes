import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  Stack,
  Text,
  Timeline,
} from "@mantine/core";
import { IconAlertCircle, IconHistory } from "@tabler/icons-react";
import type { VisitReadDetailDto } from "@costumes/shared";
import {
  unmatchedMoneyOperations,
  unknownPrepayment,
} from "../../utils/visitTimeline";
import { formatVisitMoney } from "../../utils/visitReadFormatters";
import { useVisitHistory } from "../../hooks/useVisitHistory";
import {
  formatVisitHistoryInstant,
  groupVisitHistoryEvents,
  presentVisitHistoryGroup,
} from "../../utils/visitHistory";

interface VisitHistoryProps {
  visitId: number;
  visit?: VisitReadDetailDto;
}

export function VisitHistory({ visitId, visit }: VisitHistoryProps) {
  const query = useVisitHistory(visitId);

  if (query.isLoading) {
    return (
      <Center p="lg">
        <Stack align="center" gap="xs">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Загружаем историю визита…
          </Text>
        </Stack>
      </Center>
    );
  }

  if (query.isError && !query.data && !visit) {
    return (
      <Alert
        icon={<IconAlertCircle size={18} />}
        color="red"
        title="История недоступна"
      >
        <Stack gap="sm" align="flex-start">
          <Text size="sm">Не удалось загрузить историю визита.</Text>
          <Button
            size="xs"
            variant="light"
            onClick={() => void query.refetch()}
          >
            Повторить
          </Button>
        </Stack>
      </Alert>
    );
  }

  const pages = query.data?.pages ?? [];
  const events = pages.flatMap((page) => page.items);
  if (events.length === 0 && !visit) {
    return (
      <Alert
        icon={<IconHistory size={18} />}
        color="gray"
        title="История пока недоступна"
      >
        История для старого визита может быть неполной.
      </Alert>
    );
  }

  const groups = groupVisitHistoryEvents(events);
  const allLoaded = !query.hasNextPage;
  const unmatched = visit
    ? unmatchedMoneyOperations(events, visit.moneyOperations).filter(
        (operation) => allLoaded || operation.legacyImported,
      )
    : [];
  const missingPrepayment =
    visit && allLoaded
      ? unknownPrepayment(events, visit.totals.totalPrepayment)
      : 0;
  const entries = groups.map((group) => ({
    key: group.commandId,
    ...presentVisitHistoryGroup(group),
    dateUnknown: false,
  }));
  for (const operation of unmatched) {
    entries.push({
      key: `money-${operation.id}`,
      title:
        operation.kind === "customer_refund"
          ? "Возврат клиенту"
          : operation.kind === "debt_payment"
            ? "Погашение долга"
            : "Оплата при выдаче",
      details: [
        formatVisitMoney(operation.amount),
        ...(operation.voidedAt ? ["Аннулирована"] : []),
      ],
      occurredAt: operation.createdAt,
      actor: "Сотрудник неизвестен",
      dateUnknown: operation.legacyImported,
    });
  }
  if (missingPrepayment > 0)
    entries.push({
      key: "old-prepayment",
      title: "Предоплата по заказам",
      details: [formatVisitMoney(missingPrepayment)],
      occurredAt: "",
      actor: "Сотрудник неизвестен",
      dateUnknown: true,
    });
  entries.sort(
    (left, right) =>
      Number(right.dateUnknown) - Number(left.dateUnknown) ||
      Date.parse(left.occurredAt) - Date.parse(right.occurredAt),
  );

  return (
    <Stack gap="md">
      {events.length === 0 && (
        <Text size="sm" c="dimmed">
          {query.isError
            ? "Историю не удалось загрузить; показаны доступные денежные записи."
            : "История для старого визита может быть неполной."}
        </Text>
      )}
      <Timeline active={entries.length} bulletSize={28} lineWidth={2}>
        {entries.map((presentation) => {
          return (
            <Timeline.Item
              key={presentation.key}
              bullet={<IconHistory size={16} />}
              title={presentation.title}
            >
              <Stack gap={4} mt={4}>
                <Text size="xs" c="dimmed">
                  {presentation.dateUnknown
                    ? "Дата получения неизвестна"
                    : formatVisitHistoryInstant(presentation.occurredAt)}{" "}
                  · {presentation.actor}
                </Text>
                {presentation.details.map((detail, index) => (
                  <Text
                    key={`${presentation.key}-${index}`}
                    size="sm"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {detail}
                  </Text>
                ))}
              </Stack>
            </Timeline.Item>
          );
        })}
      </Timeline>

      {query.isError && (
        <Alert
          icon={<IconAlertCircle size={18} />}
          color="red"
          title="Не удалось загрузить следующие события"
        >
          <Button
            size="xs"
            variant="light"
            onClick={() => void query.fetchNextPage()}
          >
            Повторить
          </Button>
        </Alert>
      )}

      {query.hasNextPage && (
        <Paper withBorder p="sm" radius="md">
          <Button
            fullWidth
            variant="light"
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Показать более поздние события
          </Button>
        </Paper>
      )}
    </Stack>
  );
}
