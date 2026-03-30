import { useState, useCallback, memo } from "react";
import { IconCalendarExclamation, IconShirt } from "@tabler/icons-react";
import { SelectionManager } from "src/components/selection/SelectionManager";
import { useQueryClient } from "@tanstack/react-query";
import type {
  CostumeSelectorProps,
  SelectedCostumeData,
} from "../types/costumeTypes";
import { costumesKeys } from "../hooks/useCostumes";
import { SelectedCostumeCard } from "./selectedCostumeCard";
import { CostumeSearchAvailableField } from "./costumeSearchAvailableField";
import { CostumeCreateForm } from "./costumeCreate";
import { Group, Paper, Stack, Text } from "@mantine/core";

export const CostumeSelector = memo(function CostumeSelector({
  value,
  onChange,
  error,
  startDateTime,
  endDateTime,
  issueTimeFrom,
  returnTimeUntil,
}: CostumeSelectorProps) {
  const queryClient = useQueryClient();
  const [selectedCostume, setSelectedCostume] =
    useState<SelectedCostumeData | null>(null);

  const handleSelect = useCallback(
    (costume: SelectedCostumeData | null) => {
      if (costume) {
        queryClient.setQueryData(
          costumesKeys.detail(costume.costumeId),
          costume,
        );
      }
      setSelectedCostume(costume);
      onChange(costume?.costumeId || null);
    },
    [onChange, queryClient],
  );

  const handleClear = useCallback(() => {
    setSelectedCostume(null);
    onChange(null);
  }, [onChange]);

  const isDatesMissing = !startDateTime || !endDateTime;

  if (isDatesMissing) {
    return (
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Костюм
        </Text>
        <Paper
          withBorder
          p="xs"
          radius="md"
          bg="gray.0"
          style={{
            borderStyle: "dashed",
            minHeight: "42px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Group gap="xs" c="dimmed">
            <IconCalendarExclamation size="1.1rem" />
            <Text size="xs">Сначала выберите даты визита</Text>
          </Group>
        </Paper>
      </Stack>
    );
  }

  return (
    <SelectionManager
      key={value ?? "empty"}
      variant="embedded"
      label="Костюм"
      isSelected={!!selectedCostume}
      createTitle="Создать новый костюм"
      createIcon={<IconShirt size="1.2rem" />}
      // Рендерим карточку выбранного клиента
      renderSelected={
        <SelectedCostumeCard
          costume={selectedCostume!}
          onClearSelection={handleClear}
          onUpdate={handleSelect}
        />
      }
      // Рендерим поле поиска
      renderSearch={
        <CostumeSearchAvailableField
          value={value}
          onSelect={handleSelect}
          error={error}
          startDateTime={startDateTime}
          endDateTime={endDateTime}
          returnTimeUntil={returnTimeUntil}
          issueTimeFrom={issueTimeFrom}
        />
      }
      // Рендерим форму создания
      renderCreate={
        <CostumeCreateForm
          onCreated={(newCostume) => {
            handleSelect(newCostume);
            // Закрытие формы произойдет автоматически, так как isSelected станет true
          }}
        />
      }
    />
  );
});
