import { formatPhoneNumber } from "src/utills/formatters";
import { SelectedCard } from "src/components/selection/SelectedCard";
import { ClientUpdateForm } from "./clientUpdateForm";
import { clientKeys, useDeleteClient } from "../../hooks/useClients";
import type { SelectedClientCardProps } from "../../types/clientTypes";
import { useQueryClient } from "@tanstack/react-query";

export function SelectedClientCard({
  client,
  onClearSelection,
  onUpdate,
}: SelectedClientCardProps) {
  const deleteMutation = useDeleteClient();
  const queryClient = useQueryClient();

  const handleDelete = () => {
    deleteMutation.mutate(Number(client.id), {
      onSuccess: () => onClearSelection(),
    });
  };

  return (
    <SelectedCard
      title={client.name}
      description={formatPhoneNumber(client.phone)}
      changeLabel="Выбрать другого клиента"
      deleteModalTitle="Удаление клиента"
      onClear={onClearSelection}
      onDelete={handleDelete}
      isDeleting={deleteMutation.isPending}
      renderUpdateForm={(close) => (
        <ClientUpdateForm
          client={client}
          onCancel={close}
          onSuccess={(updated) => {
            queryClient.setQueryData(clientKeys.formState(updated.id), updated);

            onUpdate(updated);
            close();
          }}
        />
      )}
    />
  );
}
