import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Radio,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconCalendarEvent, IconFilter } from "@tabler/icons-react";
import { useState } from "react";
import {
  allVisitDates,
  visitPeriodLabel,
  visitPeriodRange,
  type VisitPeriodFilterValue,
  type VisitPeriodPreset,
} from "../../utils/visitPeriodFilter";
import { VisitMobileFilters } from "./mobile/VisitMobileFilters";

interface Props {
  value: VisitPeriodFilterValue;
  onChange: (value: VisitPeriodFilterValue) => void;
  isMobile: boolean;
}

export function VisitPeriodFilter({ value, onChange, isMobile }: Props) {
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const open = () => {
    setDraft(value);
    setError(null);
    setOpened(true);
  };
  const select = (preset: VisitPeriodPreset) => {
    setDraft(
      preset === "custom"
        ? { ...draft, preset }
        : visitPeriodRange(preset, new Date()),
    );
    setError(null);
  };
  const apply = () => {
    const next =
      draft.preset === "custom"
        ? draft
        : visitPeriodRange(draft.preset, new Date());
    if (
      next.preset === "custom" &&
      (!next.from || !next.to || next.from > next.to)
    ) {
      setError("Укажите начало и конец периода в правильном порядке");
      return;
    }
    onChange(next);
    setOpened(false);
  };
  const fields = (
    <Stack gap="lg">
      <Radio.Group
        value={draft.preset}
        onChange={(value) => select(value as VisitPeriodPreset)}
        label="Период выдачи"
      >
        <Stack gap="md" mt="sm">
          <Radio value="all" label="За всё время" />
          <Radio value="today" label="Сегодня" />
          <Radio value="yesterday" label="Вчера" />
          <Radio value="week" label="С начала недели" />
          <Radio value="custom" label="Выбрать период" />
        </Stack>
      </Radio.Group>
      {draft.preset === "custom" && (
        <Group grow>
          <TextInput
            type="date"
            label="Выдача с"
            value={draft.from}
            onChange={(event) =>
              setDraft({ ...draft, from: event.currentTarget.value })
            }
          />
          <TextInput
            type="date"
            label="Выдача по"
            value={draft.to}
            onChange={(event) =>
              setDraft({ ...draft, to: event.currentTarget.value })
            }
          />
        </Group>
      )}
      {error && (
        <Text c="red" role="alert">
          {error}
        </Text>
      )}
      <Button onClick={apply}>Применить</Button>
      <Button
        variant="subtle"
        onClick={() => {
          onChange(allVisitDates);
          setOpened(false);
        }}
      >
        Сбросить период
      </Button>
    </Stack>
  );
  return (
    <>
      {isMobile ? (
        <Button
          variant="subtle"
          color="dark"
          leftSection={<IconCalendarEvent size={20} />}
          onClick={open}
        >
          {visitPeriodLabel(value)}
        </Button>
      ) : (
        <Group gap="xs">
          <Text size="sm">{visitPeriodLabel(value)}</Text>
          <ActionIcon
            variant="light"
            aria-label="Фильтр периода"
            onClick={open}
          >
            <IconFilter size={18} />
          </ActionIcon>
        </Group>
      )}
      {isMobile ? (
        <VisitMobileFilters opened={opened} onClose={() => setOpened(false)}>
          {fields}
        </VisitMobileFilters>
      ) : (
        <Modal
          opened={opened}
          onClose={() => setOpened(false)}
          title="Фильтр по дате выдачи"
        >
          {fields}
        </Modal>
      )}
    </>
  );
}
