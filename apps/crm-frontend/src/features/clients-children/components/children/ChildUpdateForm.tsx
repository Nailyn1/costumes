import { useState } from "react";
import type { SelectedChild } from "../../types/clientTypes";
import { Button, Group, Stack, TextInput } from "@mantine/core";

export function ChildUpdateForm({
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
