import { useState, memo, type ReactNode } from "react";
import { Paper, Stack, Group, Text, ActionIcon, Collapse } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";

interface SelectionManagerProps {
  label: string;
  isSelected: boolean;
  createTitle?: string;
  createIcon?: ReactNode;
  renderSelected: ReactNode;
  renderSearch: ReactNode;
  renderCreate: ReactNode;
}

export const SelectionManager = memo(function SelectionManager({
  label,
  isSelected,
  createTitle = "Добавить",
  createIcon = <IconPlus size="1.2rem" />,
  renderSelected,
  renderSearch,
  renderCreate,
}: SelectionManagerProps) {
  const [isCreating, setIsCreating] = useState(false);

  const toggleCreating = () => setIsCreating((prev) => !prev);

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>{label}</Text>

          {!isSelected && (
            <ActionIcon
              variant={isCreating ? "light" : "subtle"}
              color={isCreating ? "red" : "blue"}
              onClick={toggleCreating}
              title={isCreating ? "Отменить" : createTitle}
            >
              {isCreating ? <IconX size="1.2rem" /> : createIcon}
            </ActionIcon>
          )}
        </Group>

        {isSelected ? (
          renderSelected
        ) : (
          <>
            {!isCreating && renderSearch}

            <Collapse in={isCreating}>
              <div key={isCreating ? "active" : "reset"}>{renderCreate}</div>
            </Collapse>
          </>
        )}
      </Stack>
    </Paper>
  );
});
