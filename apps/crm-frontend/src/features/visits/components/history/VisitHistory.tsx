import {
  Alert,
  Badge,
  Button,
  Center,
  Loader,
  Paper,
  Stack,
  Text,
  Timeline,
} from "@mantine/core";
import { IconAlertCircle, IconHistory } from "@tabler/icons-react";
import { useVisitHistory } from "../../hooks/useVisitHistory";
import {
  formatVisitHistoryInstant,
  groupVisitHistoryEvents,
  presentVisitHistoryGroup,
} from "../../utils/visitHistory";

interface VisitHistoryProps {
  visitId: number;
}

export function VisitHistory({ visitId }: VisitHistoryProps) {
  const query = useVisitHistory(visitId);

  if (query.isLoading) {
    return (
      <Center p="lg">
        <Stack align="center" gap="xs">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Загружаем историю визита…</Text>
        </Stack>
      </Center>
    );
  }

  if (query.isError && !query.data) {
    return (
      <Alert icon={<IconAlertCircle size={18} />} color="red" title="История недоступна">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">Не удалось загрузить историю визита.</Text>
          <Button size="xs" variant="light" onClick={() => void query.refetch()}>
            Повторить
          </Button>
        </Stack>
      </Alert>
    );
  }

  const pages = query.data?.pages ?? [];
  const events = pages.flatMap((page) => page.items);
  if (events.length === 0) {
    return (
      <Alert icon={<IconHistory size={18} />} color="gray" title="История пока недоступна">
        История для старого визита может быть неполной.
      </Alert>
    );
  }

  const groups = groupVisitHistoryEvents(events);

  return (
    <Stack gap="md">
      <Timeline active={groups.length} bulletSize={28} lineWidth={2}>
        {groups.map((group) => {
          const presentation = presentVisitHistoryGroup(group);
          return (
            <Timeline.Item
              key={group.commandId}
              bullet={<IconHistory size={16} />}
              title={presentation.title}
            >
              <Stack gap={4} mt={4}>
                <Text size="xs" c="dimmed">
                  {formatVisitHistoryInstant(presentation.occurredAt)} · {presentation.actor}
                </Text>
                {presentation.details.map((detail, index) => (
                  <Text key={`${group.commandId}-${index}`} size="sm" style={{ overflowWrap: "anywhere" }}>
                    {detail}
                  </Text>
                ))}
                {group.events.length > 1 && (
                  <Badge size="xs" variant="light" color="gray" w="fit-content">
                    Одно действие
                  </Badge>
                )}
              </Stack>
            </Timeline.Item>
          );
        })}
      </Timeline>

      {query.isError && (
        <Alert icon={<IconAlertCircle size={18} />} color="red" title="Не удалось загрузить следующие события">
          <Button size="xs" variant="light" onClick={() => void query.fetchNextPage()}>
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
