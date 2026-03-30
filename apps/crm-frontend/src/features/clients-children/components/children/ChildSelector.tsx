import { memo, useCallback, useMemo } from "react";
import { IconBabyCarriage } from "@tabler/icons-react";
import { Stack, Text, Paper, Group } from "@mantine/core";
import { SelectionManager } from "src/components/selection/SelectionManager";
import { useClient } from "../../hooks/useClients";
import { ChildSearchField } from "./ChildSearchField";
import { SelectedChildCard } from "./SelectedChildCard";
import type { SelectedChild } from "../../types/clientTypes";
import { ChildCreateForm } from "./ChildCreateForm";
import { useQueryClient } from "@tanstack/react-query";

interface ChildSelectorProps {
  clientId: number | null;
  value?: number | null;
  onChange: (childId: number | null) => void;
  error?: React.ReactNode;
}

export const ChildSelector = memo(function ChildSelector({
  clientId,
  value,
  onChange,
  error,
}: ChildSelectorProps) {
  const { data: client } = useClient(clientId);
  const queryClient = useQueryClient();

  const selectedChild = useMemo(() => {
    if (!client || !client.children || !value) {
      return null;
    }

    return client.children.find((c) => c.childId === value) || null;
  }, [client, value]);

  const handleSelect = useCallback(
    (child: SelectedChild | null) => {
      if (child) {
        queryClient.setQueryData(
          ["children", "detail", child.childId.toString()],
          child,
        );
      }
      onChange(child?.childId || null);
    },
    [onChange, queryClient],
  );

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  if (!clientId) {
    return (
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Ребенок
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
            <IconBabyCarriage size="1.1rem" />
            <Text size="xs">Сначала выберите клиента</Text>
          </Group>
        </Paper>
      </Stack>
    );
  }

  return (
    <SelectionManager
      key={value ?? "empty"}
      variant="embedded"
      label="Ребенок"
      isSelected={!!selectedChild}
      createTitle="Добавить ребенка"
      createIcon={<IconBabyCarriage size="1.2rem" />}
      renderSelected={
        selectedChild && (
          <SelectedChildCard
            child={selectedChild}
            clientId={clientId}
            onClearSelection={handleClear}
          />
        )
      }
      renderSearch={
        <ChildSearchField
          clientId={clientId}
          value={value?.toString() || null}
          onSelect={handleSelect}
          error={error}
        />
      }
      renderCreate={
        <ChildCreateForm
          clientId={clientId}
          onCreated={(newChild) => {
            handleSelect(newChild);
          }}
        />
      }
    />
  );
});
