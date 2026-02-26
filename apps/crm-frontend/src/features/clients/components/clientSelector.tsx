import { useState, useCallback, memo } from "react";
import { Paper, Stack, Group, Text, ActionIcon, Collapse } from "@mantine/core";
import { IconUserPlus, IconX } from "@tabler/icons-react";

// Импортируем наши новые компоненты
import { SelectedClientCard } from "./selectedClientCard";
import { ClientSearchField } from "./clientSearchField";
import { ClientCreateForm } from "./clientCreate";
import type {
  SelectedClientData,
  ClientSelectorProps,
} from "../types/clientTypes";

export const ClientSelector = memo(function ClientSelector({
  value,
  onChange,
  error,
}: ClientSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedClient, setSelectedClient] =
    useState<SelectedClientData | null>(null);

  const handleSelectClient = useCallback(
    (client: SelectedClientData | null) => {
      setSelectedClient(client);
      onChange(client?.id || null);
    },
    [onChange],
  );

  const handleCreated = useCallback(
    (client: SelectedClientData) => {
      setSelectedClient(client);
      onChange(client.id);
      setIsCreating(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    setSelectedClient(null);
    onChange(null);
  }, [onChange]);

  const toggleCreating = () => {
    setIsCreating((prev) => !prev);
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>1. Клиент</Text>

          {!selectedClient && (
            <ActionIcon
              variant={isCreating ? "light" : "subtle"}
              color={isCreating ? "red" : "blue"}
              onClick={toggleCreating}
              title={isCreating ? "Отменить" : "Создать нового клиента"}
            >
              {isCreating ? (
                <IconX size="1.2rem" />
              ) : (
                <IconUserPlus size="1.2rem" />
              )}
            </ActionIcon>
          )}
        </Group>

        {/* 1. Если клиент выбран — показываем карточку */}
        {selectedClient ? (
          <SelectedClientCard
            client={selectedClient}
            onClearSelection={handleClear}
            onUpdate={handleSelectClient}
          />
        ) : (
          <>
            {/* 2. Если не выбран и не создаем — показываем поиск */}
            {!isCreating && (
              <ClientSearchField
                value={value}
                onSelect={handleSelectClient}
                error={error}
              />
            )}

            {/* 3. Если нажали "плюс" — показываем форму создания */}
            <Collapse in={isCreating}>
              <ClientCreateForm
                onCreated={handleCreated}
                key={isCreating ? "active" : "reset"}
              />
            </Collapse>
          </>
        )}
      </Stack>
    </Paper>
  );
});
