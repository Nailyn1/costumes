import { useState } from "react";
import { TextInput, Group, Button, Stack } from "@mantine/core";
import { SelectedCard } from "src/components/selection/SelectedCard";
import { useUpdateChild, useDeleteChild } from "../../hooks/useChild";
import type { SelectedChild } from "../../types/clientTypes";

interface SelectedChildCardProps {
  child: SelectedChild;
  clientId: number;
  onClearSelection: () => void;
}

export function SelectedChildCard({
  child,
  clientId,
  onClearSelection,
}: SelectedChildCardProps) {
  const updateChildMutation = useUpdateChild();
  const deleteChildMutation = useDeleteChild();

  const handleDelete = () => {
    deleteChildMutation.mutate(
      { childId: child.childId, clientId },
      {
        onSuccess: () => {
          onClearSelection();
        },
      },
    );
  };

  return (
    <SelectedCard
      title={child.name}
      changeLabel="Выбрать другого ребенка"
      deleteModalTitle="Удаление ребенка"
      onClear={onClearSelection}
      onDelete={handleDelete}
      isDeleting={deleteChildMutation.isPending}
      renderUpdateForm={(close) => (
        <ChildUpdateForm
          child={child}
          onClose={close}
          isLoading={updateChildMutation.isPending}
          onSave={(newName) =>
            updateChildMutation.mutate(
              { childId: child.childId, clientId, name: newName },
              { onSuccess: close },
            )
          }
        />
      )}
    />
  );
}

function ChildUpdateForm({
  child,
  onSave,
  onClose,
  isLoading,
}: {
  child: SelectedChild;
  onSave: (name: string) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [value, setValue] = useState(child.name);

  return (
    <Stack gap="xs">
      <TextInput
        label="Имя ребенка"
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        autoFocus
      />
      <Group justify="flex-end" gap="xs">
        <Button
          variant="subtle"
          size="xs"
          onClick={onClose}
          disabled={isLoading}
        >
          Отмена
        </Button>
        <Button size="xs" onClick={() => onSave(value)} loading={isLoading}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  );
}
