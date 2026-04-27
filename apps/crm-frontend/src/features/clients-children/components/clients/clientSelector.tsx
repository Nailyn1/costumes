import { useState, useCallback, memo } from "react";
import { IconUserPlus } from "@tabler/icons-react";

import { SelectedClientCard } from "./selectedClientCard";
import { ClientSearchField } from "./clientSearchField";
import { ClientCreateForm } from "./clientCreate";

import type {
  SelectedClientData,
  ClientSelectorProps,
} from "../../types/clientTypes";
import { SelectionManager } from "src/components/selection/SelectionManager";
import { useQueryClient } from "@tanstack/react-query";
import { clientKeys } from "../../hooks/useClients";

export const ClientSelector = memo(function ClientSelector({
  value,
  onChange,
  error,
}: ClientSelectorProps) {
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] =
    useState<SelectedClientData | null>(null);

  const handleSelect = useCallback(
    (client: SelectedClientData | null) => {
      if (client) {
        queryClient.setQueryData(clientKeys.formState(client.id), client);
      }
      setSelectedClient(client);
      onChange(client?.id || null);
    },
    [onChange, queryClient],
  );

  const handleClear = useCallback(() => {
    setSelectedClient(null);
    onChange(null);
  }, [onChange]);

  return (
    <SelectionManager
      key={value ?? "empty"}
      label="1. Клиент"
      isSelected={!!selectedClient}
      createTitle="Создать нового клиента"
      createIcon={<IconUserPlus size="1.2rem" />}
      renderSelected={
        <SelectedClientCard
          client={selectedClient!}
          onClearSelection={handleClear}
          onUpdate={handleSelect}
        />
      }
      renderSearch={
        <ClientSearchField
          value={value}
          onSelect={handleSelect}
          error={error}
        />
      }
      renderCreate={
        <ClientCreateForm
          onCreated={(newClient) => {
            handleSelect(newClient);
          }}
        />
      }
    />
  );
});
