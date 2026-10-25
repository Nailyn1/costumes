import {
  Badge,
  Button,
  Center,
  Chip,
  Group,
  Loader,
  Pagination,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { VisitListQueryDto } from "@costumes/shared";
import { useVisitList } from "../../hooks/useVisitReads";
import {
  formatVisitMoney,
  visitStatusLabels,
} from "../../utils/visitReadFormatters";
import { formatStayDates } from "src/utils/formatters";
import {
  allVisitDates,
  type VisitPeriodFilterValue,
} from "../../utils/visitPeriodFilter";
import { VisitMobileCard } from "./mobile/VisitMobileCard";
import { VisitPeriodFilter } from "./VisitPeriodFilter";

const PAGE_LIMIT = 20;
const statuses = [
  "all",
  "reserved",
  "issued",
  "completed",
  "cancelled",
] as const;
type Status = (typeof statuses)[number];

export function VisitsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 400);
  const [status, setStatus] = useState<Status>("all");
  const [period, setPeriod] = useState<VisitPeriodFilterValue>(allVisitDates);
  const [page, setPage] = useState(1);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const query: VisitListQueryDto = {
    ...(debouncedSearch.length >= 2 ? { q: debouncedSearch } : {}),
    ...(status !== "all" ? { status } : {}),
    ...(period.from ? { startDateFrom: period.from } : {}),
    ...(period.to ? { startDateTo: period.to } : {}),
    page,
    limit: PAGE_LIMIT,
  };
  const visitsQuery = useVisitList(query);
  const items = visitsQuery.data?.items ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil((visitsQuery.data?.total ?? 0) / PAGE_LIMIT),
  );
  const openVisit = (id: number) => navigate(`/bookings/visits/${id}`);

  return (
    <Stack gap="md">
      <TextInput
        aria-label="Поиск визитов"
        placeholder="Код, клиент, телефон, ребёнок или костюм"
        leftSection={<IconSearch size={18} />}
        value={search}
        onChange={(event) => {
          setSearch(event.currentTarget.value);
          setPage(1);
        }}
      />
      <ScrollArea type="never">
        <Chip.Group
          value={status}
          onChange={(value) => {
            if (statuses.includes(value as Status)) setStatus(value as Status);
            setPage(1);
          }}
        >
          <Group wrap="nowrap" gap="xs" pb={4}>
            {statuses.map((value) => (
              <Chip key={value} value={value} variant="outline">
                {value === "all" ? "Все" : visitStatusLabels[value]}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </ScrollArea>
      <Group justify="space-between">
        <VisitPeriodFilter
          value={period}
          onChange={(value) => {
            setPeriod(value);
            setPage(1);
          }}
          isMobile={isMobile}
        />
        <Text size="sm" c="dimmed">
          {visitsQuery.data?.total ?? 0} визитов
        </Text>
      </Group>
      {visitsQuery.isLoading ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : visitsQuery.isError ? (
        <Paper withBorder p="md">
          <Stack>
            <Text c="red">Не удалось загрузить список визитов.</Text>
            <Button variant="light" onClick={() => void visitsQuery.refetch()}>
              Повторить
            </Button>
          </Stack>
        </Paper>
      ) : items.length === 0 ? (
        <Paper withBorder p="xl">
          <Text ta="center" c="dimmed">
            Визиты не найдены
          </Text>
        </Paper>
      ) : isMobile ? (
        <Stack>
          {items.map((visit) => (
            <VisitMobileCard key={visit.id} visit={visit} />
          ))}
        </Stack>
      ) : (
        <Paper withBorder radius="md" p="xs">
          <Table.ScrollContainer minWidth={900}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Визит</Table.Th>
                  <Table.Th>Клиент</Table.Th>
                  <Table.Th>Срок</Table.Th>
                  <Table.Th>Состав</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Суммы</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((visit) => (
                  <Table.Tr
                    key={visit.id}
                    onClick={() => openVisit(visit.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openVisit(visit.id);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Открыть визит ${visit.visitCode}`}
                    style={{ cursor: "pointer" }}
                  >
                    <Table.Td>
                      <Text fw={600}>#{visit.visitCode}</Text>
                    </Table.Td>
                    <Table.Td>
                      {visit.client.name}
                      <Text size="xs" c="dimmed">
                        {visit.client.phone}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {formatStayDates(visit.startDateTime, visit.endDateTime)}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{visit.childrenNames || "—"}</Text>
                      <Text size="sm" c="dimmed">
                        {visit.costumesNames || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">
                        {visitStatusLabels[visit.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        Аренда: {formatVisitMoney(visit.totalRent)}
                      </Text>
                      <Text size="sm">
                        Предоплата: {formatVisitMoney(visit.totalPrepayment)}
                      </Text>
                      {visit.status === "reserved" && (
                        <Text size="sm">
                          Доплата: {formatVisitMoney(visit.totalRemaining)}
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}
      {visitsQuery.data && totalPages > 1 && (
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Страница {page} из {totalPages}
          </Text>
          <Pagination
            total={totalPages}
            value={page}
            onChange={setPage}
            withControls
            size={isMobile ? "sm" : "md"}
          />
        </Group>
      )}
      {visitsQuery.isFetching && !visitsQuery.isLoading && (
        <Text size="xs" c="dimmed" ta="right">
          Обновляем список…
        </Text>
      )}
    </Stack>
  );
}
