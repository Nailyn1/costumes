import { memo, useCallback, useMemo } from "react";
import { IconBabyCarriage } from "@tabler/icons-react";
import { Stack, TextInput, Button, Text, Paper, Group } from "@mantine/core";
import { useForm } from "@mantine/form";

import { SelectionManager } from "src/components/selection/SelectionManager";
import { useClient } from "../../hooks/useClients";
import { useCreateChild } from "../../hooks/useChild";
import { ChildSearchField } from "./ChildSearchField";
import { SelectedChildCard } from "./SelectedChildCard";
import type { SelectedChild } from "../../types/clientTypes";

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

  const selectedChild = useMemo(() => {
    if (!client || !client.children || !value) {
      return null;
    }

    return client.children.find((c) => c.childId === value) || null;
  }, [client, value]);

  const handleSelect = useCallback(
    (child: SelectedChild | null) => {
      onChange(child?.childId || null);
    },
    [onChange],
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

function ChildCreateForm({
  clientId,
  onCreated,
}: {
  clientId: number;
  onCreated: (child: SelectedChild) => void;
}) {
  const createMutation = useCreateChild();
  const form = useForm({
    initialValues: { name: "" },
    validate: { name: (v) => (v.length < 2 ? "Слишком короткое имя" : null) },
  });

  const handleSubmit = (values: typeof form.values) => {
    createMutation.mutate(
      { clientId, name: values.name },
      {
        onSuccess: (data) => {
          onCreated({ childId: data.childId, name: data.name });
          form.reset();
        },
      },
    );
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="xs">
        <TextInput
          label="Имя нового ребенка"
          placeholder="Введите имя"
          {...form.getInputProps("name")}
          autoFocus
        />
        <Button
          type="submit"
          size="xs"
          loading={createMutation.isPending}
          fullWidth
        >
          Создать и выбрать
        </Button>
      </Stack>
    </form>
  );
}
