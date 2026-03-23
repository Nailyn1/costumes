import { formatPhoneNumber } from "src/utills/formatters";
import { SelectedCard } from "src/components/selection/SelectedCard";
import { ClientUpdateForm } from "./clientUpdateForm";
import { useDeleteClient } from "../../hooks/useClients";
import type { SelectedClientCardProps } from "../../types/clientTypes";

export function SelectedClientCard({
  client,
  onClearSelection,
  onUpdate,
}: SelectedClientCardProps) {
  const deleteMutation = useDeleteClient();

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
      // close — это та самая функция, которая делает setIsEditing(false) в родителе
      renderUpdateForm={(close) => (
        <ClientUpdateForm
          client={client}
          onCancel={close}
          onSuccess={(updated) => {
            // Сначала уведомляем форму Booking, что клиент изменился
            onUpdate(updated);
            // Затем закрываем режим редактирования в карточке
            close();
          }}
        />
      )}
    />
  );
}
