import {
  Title,
  Table,
  Text,
  Paper,
  Stack,
  Box,
  Center,
  Loader,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import dayjs from "dayjs";
import { useState } from "react";
import { IssueDesktopTable } from "src/features/visits/components/issuePage/IssueDesktopTable";
import { IssueMobileCards } from "src/features/visits/components/issuePage/IssueMobileCards";
import { IssueFilters } from "src/features/visits/components/VisitFilters";
import {
  useReservedVisits,
  useVisitForIssue,
} from "src/features/visits/hooks/useVisits";
import { InView } from "react-intersection-observer";
import type { GetReservedParams } from "src/features/visits/services/visits.service";
import type { ReservedVisitItem } from "src/features/visits/types/visitTypes";
import { IssueModal } from "src/features/visits/components/issuePage/IsuueModal";
import { IssueSearchInput } from "src/features/visits/components/issuePage/IssueSearchInput";

export function IssuePage() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  const todayStr = dayjs().format("YYYY-MM-DD");
  const [preset, setPreset] = useState<string>("today");
  const [filters, setFilters] = useState<GetReservedParams>({
    startDate: todayStr,
    endDate: todayStr,
  });
  const isCustomEmpty =
    preset === "custom" && !filters.startDate && !filters.endDate;
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useReservedVisits(filters, !isCustomEmpty);

  const allVisits = data?.pages.flatMap((page) => page.items) || [];

  const [opened, { open, close }] = useDisclosure(false);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);

  const {
    data: visitDetails,
    isLoading: isVisitLoading,
    isError: isVisitError,
  } = useVisitForIssue(selectedVisitId);

  const handleOpenVisit = (visit: ReservedVisitItem) => {
    setSelectedVisitId(visit.visitId);
    open();
  };

  const handleOpenVisitById = (id: number) => {
    setSelectedVisitId(id);
    open();
  };

  const handleCloseModal = () => {
    setSelectedVisitId(null);
    close();
  };

  return (
    <Stack gap="lg">
      <Title order={isMobile ? 3 : 2}>Выдача костюмов</Title>

      <Paper withBorder p="md" radius="md" shadow="xs">
        <IssueSearchInput onSelectVisit={handleOpenVisitById} />
      </Paper>

      <IssueFilters
        filters={filters}
        onChange={setFilters}
        preset={preset}
        onPresetChange={setPreset}
      />
      <Box>
        {isLoading && allVisits.length === 0 ? (
          <Text p="md" c="dimmed" ta="center">
            Загрузка данных...
          </Text>
        ) : allVisits.length === 0 ? (
          <Paper withBorder p="xl" radius="md" bg="gray.0" ta="center">
            <Text c="dimmed" size="lg" fw={500}>
              На эти даты заказов нет
            </Text>
          </Paper>
        ) : isMobile ? (
          <IssueMobileCards items={allVisits} onOpenVisit={handleOpenVisit} />
        ) : (
          <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
            <Table.ScrollContainer minWidth={800}>
              <IssueDesktopTable
                items={allVisits}
                onOpenVisit={handleOpenVisit}
              />
            </Table.ScrollContainer>
          </Paper>
        )}
      </Box>

      <InView
        as="div"
        rootMargin="100px"
        onChange={(inView) => {
          if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
      >
        <div style={{ height: 10, width: "100%" }} />
      </InView>
      {isFetchingNextPage && (
        <Center p="md">
          <Loader color="blue" type="dots" />
        </Center>
      )}
      <IssueModal
        opened={opened}
        onClose={handleCloseModal}
        visitId={selectedVisitId}
        isMobile={isMobile}
        data={visitDetails}
        isLoading={isVisitLoading}
        isError={isVisitError}
      />
    </Stack>
  );
}
