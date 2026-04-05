import {
  Stack,
  Title,
  Group,
  Text,
  Center,
  Loader,
  Button,
} from "@mantine/core";
import { useShowNotification } from "src/features/visits/hooks/useNotifications";
import { NotificationCard } from "src/features/visits/components/NotificationCard";

const getTotalTodayColor = (total: number) => {
  if (total < 30) return "green";
  if (total <= 70) return "orange";
  return "red";
};

export function NotificationPage() {
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useShowNotification();

  // Достаем totalToday из первой страницы пагинации (безопасное извлечение)
  const totalToday = data?.pages[0]?.totalToday || 0;
  const color = getTotalTodayColor(totalToday);

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (isError) {
    return (
      <Center h="100vh">
        <Text c="red">Ошибка загрузки данных</Text>
      </Center>
    );
  }

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
      <Stack gap="md">
        {data?.pages.map((page) =>
          page.items.map((item) => (
            <NotificationCard key={item.notificationId} item={item} />
          )),
        )}
      </Stack>

      {hasNextPage && (
        <Center mt="md">
          <Button
            variant="light"
            onClick={() => fetchNextPage()}
            loading={isFetchingNextPage}
          >
            Загрузить еще
          </Button>
        </Center>
      )}
    </Stack>
  );
}
