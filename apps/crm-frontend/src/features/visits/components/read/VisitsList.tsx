import {
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Pagination,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { PaginatedVisitsResponseDto, VisitListQueryDto, VisitReadDetailDto } from "@costumes/shared";
import { useVisitList } from "src/features/visits/hooks/useVisitReads";
import {
  formatVisitMoney,
  formatVisitPeriod,
  visitStatusLabels,
} from "src/features/visits/utils/visitReadFormatters";

const PAGE_LIMIT = 20;
type VisitListItemDto = PaginatedVisitsResponseDto["items"][number];
const statusOptions = [
  { value: "reserved", label: visitStatusLabels.reserved },
  { value: "issued", label: visitStatusLabels.issued },
  { value: "completed", label: visitStatusLabels.completed },
  { value: "cancelled", label: visitStatusLabels.cancelled },
];

function statusColor(status: VisitReadDetailDto["status"]): string {
  if (status === "reserved") return "blue";
  if (status === "issued") return "orange";
  if (status === "completed") return "green";
  return "gray";
}

function VisitStatusBadge({ status }: { status: VisitReadDetailDto["status"] }) {
  return <Badge color={statusColor(status)}>{visitStatusLabels[status]}</Badge>;
}

function VisitCard({ visit }: { visit: VisitListItemDto }) {
  return (
    <Paper component={Link} to={`/bookings/visits/${visit.id}`} withBorder p="md" radius="md" style={{ color: "inherit", textDecoration: "none" }}>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Text fw={700}>#{visit.visitCode}</Text>
            <Text>{visit.client.name}</Text>
            <Text size="sm" c="dimmed">{visit.client.phone}</Text>
          </Box>
          <VisitStatusBadge status={visit.status} />
        </Group>
        <Text size="sm">{formatVisitPeriod(visit.startDateTime, visit.endDateTime)}</Text>
        <Text size="sm">Дети: {visit.childrenNames || "—"}</Text>
        <Text size="sm">Костюмы: {visit.costumesNames || "—"}</Text>
        <Text size="sm">Заказов: {visit.orderCount}</Text>
        <Group justify="space-between" gap="xs">
          <Text size="sm">Аренда: {formatVisitMoney(visit.totalRent)}</Text>
          <Text size="sm">Предоплата: {formatVisitMoney(visit.totalPrepayment)}</Text>
        </Group>
        {visit.status === "reserved" && <Text size="sm" fw={600}>К доплате при выдаче: {formatVisitMoney(visit.totalRemaining)}</Text>}
      </Stack>
    </Paper>
  );
}

export function VisitsList() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 400);
  const [status, setStatus] = useState<string | null>(null);
  const [startDateFrom, setStartDateFrom] = useState("");
  const [startDateTo, setStartDateTo] = useState("");
  const [endDateFrom, setEndDateFrom] = useState("");
  const [endDateTo, setEndDateTo] = useState("");
  const [page, setPage] = useState(1);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const query: VisitListQueryDto = {
    ...(debouncedSearch.length >= 2 ? { q: debouncedSearch } : {}),
    ...(status ? { status: status as NonNullable<VisitListQueryDto["status"]> } : {}),
    ...(startDateFrom ? { startDateFrom } : {}),
    ...(startDateTo ? { startDateTo } : {}),
    ...(endDateFrom ? { endDateFrom } : {}),
    ...(endDateTo ? { endDateTo } : {}),
    page,
    limit: PAGE_LIMIT,
  };
  const visitsQuery = useVisitList(query);
  const items = visitsQuery.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((visitsQuery.data?.total ?? 0) / PAGE_LIMIT));

  const resetToFirstPage = () => setPage(1);
  const handleStatusChange = (value: string | null) => {
    setStatus(value);
    resetToFirstPage();
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={2}>Визиты</Title>
        <Text size="sm" c="dimmed">{visitsQuery.data?.total ?? 0} всего</Text>
      </Group>

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <TextInput
            label="Поиск"
            placeholder="Код, клиент, телефон, ребёнок или костюм"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => { setSearch(event.currentTarget.value); resetToFirstPage(); }}
          />
          <Select label="Статус" placeholder="Все статусы" clearable data={statusOptions} value={status} onChange={handleStatusChange} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput type="date" label="Выдача с" value={startDateFrom} onChange={(event) => { setStartDateFrom(event.currentTarget.value); resetToFirstPage(); }} />
            <TextInput type="date" label="Выдача по" value={startDateTo} onChange={(event) => { setStartDateTo(event.currentTarget.value); resetToFirstPage(); }} />
            <TextInput type="date" label="Возврат с" value={endDateFrom} onChange={(event) => { setEndDateFrom(event.currentTarget.value); resetToFirstPage(); }} />
            <TextInput type="date" label="Возврат по" value={endDateTo} onChange={(event) => { setEndDateTo(event.currentTarget.value); resetToFirstPage(); }} />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => { setSearch(""); setStatus(null); setStartDateFrom(""); setStartDateTo(""); setEndDateFrom(""); setEndDateTo(""); setPage(1); }}>
              Сбросить фильтры
            </Button>
          </Group>
        </Stack>
      </Paper>

      {visitsQuery.isLoading ? (
        <Center p="xl"><Loader /></Center>
      ) : visitsQuery.isError ? (
        <Paper withBorder p="md"><Stack><Text c="red">Не удалось загрузить список визитов.</Text><Button variant="light" onClick={() => void visitsQuery.refetch()}>Повторить</Button></Stack></Paper>
      ) : items.length === 0 ? (
        <Paper withBorder p="xl"><Text ta="center" c="dimmed">Визиты не найдены</Text></Paper>
      ) : isMobile ? (
        <Stack>
          {items.map((visit) => <VisitCard key={visit.id} visit={visit} />)}
        </Stack>
      ) : (
        <Paper withBorder radius="md" p="xs">
          <Table.ScrollContainer minWidth={1100}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead><Table.Tr><Table.Th>Визит</Table.Th><Table.Th>Клиент</Table.Th><Table.Th>Срок</Table.Th><Table.Th>Состав</Table.Th><Table.Th>Статус</Table.Th><Table.Th>Суммы</Table.Th><Table.Th /></Table.Tr></Table.Thead>
              <Table.Tbody>
                {items.map((visit) => (
                  <Table.Tr key={visit.id}>
                    <Table.Td><Text fw={600}>#{visit.visitCode}</Text></Table.Td>
                    <Table.Td>{visit.client.name}<Text size="xs" c="dimmed">{visit.client.phone}</Text></Table.Td>
                    <Table.Td>{formatVisitPeriod(visit.startDateTime, visit.endDateTime)}</Table.Td>
                    <Table.Td><Text size="sm">{visit.childrenNames || "—"}</Text><Text size="sm" c="dimmed">{visit.costumesNames || "—"}</Text></Table.Td>
                    <Table.Td><VisitStatusBadge status={visit.status} /></Table.Td>
                    <Table.Td><Text size="sm">Аренда: {formatVisitMoney(visit.totalRent)}</Text><Text size="sm">Предоплата: {formatVisitMoney(visit.totalPrepayment)}</Text>{visit.status === "reserved" && <Text size="sm">К доплате при выдаче: {formatVisitMoney(visit.totalRemaining)}</Text>}</Table.Td>
                    <Table.Td><Button component={Link} to={`/bookings/visits/${visit.id}`} variant="light" size="xs">Карточка</Button></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

      {visitsQuery.data && totalPages > 1 && (
        <Group justify="space-between">
          <Text size="sm" c="dimmed">Страница {page} из {totalPages}</Text>
          <Pagination total={totalPages} value={page} onChange={setPage} withControls size={isMobile ? "sm" : "md"} />
        </Group>
      )}
      {visitsQuery.isFetching && !visitsQuery.isLoading && <Text size="xs" c="dimmed" ta="right">Обновляем список…</Text>}
    </Stack>
  );
}
