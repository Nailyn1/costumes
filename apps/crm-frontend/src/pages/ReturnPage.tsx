import {
  Title,
  Text,
  Stack,
  Center,
  Loader,
  SegmentedControl,
  Box,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useState } from "react";
import { InView } from "react-intersection-observer";
import { DepositCard } from "src/features/visits/components/returnPage/DepositCard";
import { MarkDepositModal } from "src/features/visits/components/returnPage/MarkDepositModal";
import { ReturnCard } from "src/features/visits/components/returnPage/ReturnCard";
import { ReturnModal } from "src/features/visits/components/returnPage/ReturnModal";
import { ReturnSearchInput } from "src/features/visits/components/returnPage/ReturnSearchInput";
import {
  useIssuedVisits,
  useUnreturnedDeposits,
  useVisitForReturn,
} from "src/features/visits/hooks/useVisits";
import type { UnreturnedDepositItem } from "src/features/visits/types/visitTypes";

export function ReturnPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [view, setView] = useState<string>("awaiting");

  const [opened, { open, close }] = useDisclosure(false);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);

  const [depositOpened, { open: openDep, close: closeDep }] =
    useDisclosure(false);
  const [selectedDepVisit, setSelectedDepVisit] =
    useState<UnreturnedDepositItem | null>(null);

  const {
    data: infiniteData,
    isLoading: isListLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useIssuedVisits(view === "awaiting");

  const {
    data: depData,
    isLoading: isDepLoading,
    fetchNextPage: fetchNextDep,
    hasNextPage: hasNextDep,
    isFetchingNextPage: isFetchingNextDep,
  } = useUnreturnedDeposits(view === "deposits");

  const {
    data: visitDetails,
    isLoading: isVisitLoading,
    isError: isVisitError,
  } = useVisitForReturn(selectedVisitId);

  const handleOpenVisit = (visitId: number) => {
    setSelectedVisitId(visitId);
    open();
  };

  const handleCloseModal = () => {
    setSelectedVisitId(null);
    close();
  };

  const handleOpenDeposit = (visit: UnreturnedDepositItem) => {
    setSelectedDepVisit(visit);
    openDep();
  };

  const handleCloseDeposit = () => {
    setSelectedDepVisit(null);
    closeDep();
  };

  const allVisits = infiniteData?.pages.flatMap((page) => page.items) || [];
  const allDeposits = depData?.pages.flatMap((page) => page.items) || [];

  return (
    <Stack gap="lg">
      <Title order={isMobile ? 3 : 2}>Возврат костюмов</Title>
      <SegmentedControl
        fullWidth
        value={view}
        onChange={setView}
        data={[
          { label: "Ожидают возврата", value: "awaiting" },
          { label: "Забытые залоги", value: "deposits" },
        ]}
      />
      <ReturnSearchInput onSelectVisit={handleOpenVisit} />

      <Stack gap="sm">
        <Text fw={700} size="sm" c="dimmed" tt="uppercase">
          Ожидают возврата
        </Text>
        {view === "awaiting" && (
          <>
            {isListLoading && (
              <Center p="xl">
                <Loader />
              </Center>
            )}
            {!isListLoading && allVisits.length === 0 && (
              <Center p="xl">
                <Text c="dimmed">Список пуст</Text>
              </Center>
            )}
            {allVisits.map((visit) => (
              <ReturnCard
                key={visit.visitId}
                visit={visit}
                onClick={() => handleOpenVisit(visit.visitId)}
              />
            ))}
            <InView
              onChange={(inView) =>
                inView && hasNextPage && !isFetchingNextPage && fetchNextPage()
              }
            >
              <Box h={20} />
            </InView>
            {isFetchingNextPage && (
              <Center p="sm">
                <Loader size="sm" />
              </Center>
            )}
          </>
        )}
        {view === "deposits" && (
          <>
            {isDepLoading && (
              <Center p="xl">
                <Loader />
              </Center>
            )}
            {!isDepLoading && allDeposits.length === 0 && (
              <Center p="xl">
                <Text c="dimmed">Нет забытых залогов</Text>
              </Center>
            )}
            {allDeposits.map((visit) => (
              <DepositCard
                key={visit.visitId}
                visit={visit}
                onMarkReturned={() => handleOpenDeposit(visit)}
              />
            ))}
            <InView
              onChange={(inView) =>
                inView && hasNextDep && !isFetchingNextDep && fetchNextDep()
              }
            >
              <Box h={20} />
            </InView>
            {isFetchingNextDep && (
              <Center p="sm">
                <Loader size="sm" />
              </Center>
            )}
          </>
        )}
      </Stack>
      <ReturnModal
        opened={opened}
        onClose={handleCloseModal}
        visitId={selectedVisitId}
        isMobile={isMobile}
        data={visitDetails}
        isLoading={isVisitLoading}
        isError={isVisitError}
      />

      <MarkDepositModal
        opened={depositOpened}
        onClose={handleCloseDeposit}
        visitId={selectedDepVisit?.visitId}
        clientName={selectedDepVisit?.clientName || ""}
      />
    </Stack>
  );
}
