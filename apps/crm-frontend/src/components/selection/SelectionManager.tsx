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
  // Добавляем вариант: 'card' (по умолчанию) или 'embedded' (встроенный)
  variant?: "card" | "embedded";
}

export const SelectionManager = memo(function SelectionManager({
  label,
  isSelected,
  createTitle = "Добавить",
  createIcon = <IconPlus size="1.2rem" />,
  renderSelected,
  renderSearch,
  renderCreate,
  variant = "card",
}: SelectionManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const isEmbedded = variant === "embedded";

  const toggleCreating = () => setIsCreating((prev) => !prev);

  return (
    <Paper
      // Если embedded — убираем границы, тени и отступы
      withBorder={!isEmbedded}
      shadow={isEmbedded ? "none" : undefined}
      p={isEmbedded ? 0 : "md"}
      radius="md"
      bg={isEmbedded ? "transparent" : undefined}
    >
      <Stack gap={isEmbedded ? "xs" : "sm"}>
        <Group justify="space-between">
          {/* Стилизуем заголовок под стандартный Label инпутов, если это embedded */}
          <Text fw={isEmbedded ? 500 : 600} size={isEmbedded ? "sm" : "md"}>
            {label}
          </Text>

          {!isSelected && (
            <ActionIcon
              variant={isCreating ? "light" : "subtle"}
              color={isCreating ? "red" : "blue"}
              onClick={toggleCreating}
              size={isEmbedded ? "sm" : "md"}
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
