import {
  Stack,
  Title,
  Group,
  Text,
  Center,
  Loader,
  TextInput,
} from "@mantine/core";
import {
  useSearchNotification,
  useShowNotification,
} from "src/features/visits/hooks/useNotifications";
import { NotificationCard } from "src/features/visits/components/NotificationCard";
import { InView } from "react-intersection-observer";
import { useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import type { searchNotificationDto } from "@costumes/shared";

const getTotalTodayColor = (total: number) => {
  if (total < 30) return "green";
  if (total <= 70) return "orange";
  return "red";
};

export function NotificationPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const isSearching = debouncedSearch.trim().length >= 2;

  const {
    data: pagedData,
    isLoading: isPagedLoading,
    isError: isPagedError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useShowNotification(!isSearching);

  const {
    data: searchData,
    isLoading: isSearchLoading,
    isError: isSearchError,
  } = useSearchNotification(debouncedSearch);

  const totalToday = pagedData?.pages[0]?.totalToday || 0;
  const color = getTotalTodayColor(totalToday);

  const renderContent = () => {
    if (isSearching && isSearchLoading) {
      return (
        <Center h={200}>
          <Loader />
        </Center>
      );
    }

    if (!isSearching && isPagedLoading) {
      return (
        <Center h={200}>
          <Loader />
        </Center>
      );
    }

    if ((isSearching && isSearchError) || (!isSearching && isPagedError)) {
      return (
        <Center h={200}>
          <Text c="red">Ошибка загрузки данных</Text>
        </Center>
      );
    }

    if (isSearching) {
      if (!searchData || searchData.length === 0) {
        return (
          <Center h={200}>
            <Text c="dimmed">Ничего не найдено</Text>
          </Center>
        );
      }

      return searchData.map((item) => (
        <NotificationCard
          key={item.notificationId}
          item={item as searchNotificationDto}
        />
      ));
    }

    return (
      <>
        {pagedData?.pages.map((page) =>
          page.items.map((item) => (
            <NotificationCard key={item.notificationId} item={item} />
          )),
        )}

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
      </>
    );
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Уведомления</Title>

        <Group gap="xs">
          <Text size="md" fw={500} c="dimmed">
            Сообщений за сегодня:
          </Text>
          <Center
            w={56}
            h={56}
            style={(theme) => ({
              backgroundColor: theme.colors[color][1],
              color: theme.colors[color][9],
              borderRadius: "50%",
              fontWeight: 700,
            })}
          >
            {totalToday}
          </Center>
        </Group>
      </Group>

      <TextInput
        placeholder="Поиск по имени, телефону или коду визита..."
        leftSection={<IconSearch size={18} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        size="md"
        radius="md"
        // clearable
      />

      <Stack gap="md">{renderContent()}</Stack>
    </Stack>
  );
}
