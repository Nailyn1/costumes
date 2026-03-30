import { useState } from "react";
import { Button, Group, Stack, TextInput } from "@mantine/core";
import type { SelectedCostumeData } from "../types/costumeTypes";

export function CostumeUpdateForm({
  costume,
  onSave,
  onClose,
  isLoading,
}: {
  costume: SelectedCostumeData;
  onSave: (name: string) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [value, setValue] = useState(costume.name);

  return (
    <Stack gap="xs">
      <TextInput
        label="Название костюма"
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
