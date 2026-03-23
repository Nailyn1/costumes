import { SelectedCard } from "src/components/selection/SelectedCard";
import { useUpdateChild, useDeleteChild } from "../../hooks/useChild";
import type { SelectedChild } from "../../types/clientTypes";
import { ChildUpdateForm } from "./ChildUpdateForm";

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
