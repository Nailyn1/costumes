import { SelectedCard } from "src/components/selection/SelectedCard";
import type { SelectedCostumeCardProps } from "../types/costumeTypes";
import { useDeleteCostume, useUpdateCostume } from "../hooks/useCostumes";
import { CostumeUpdateForm } from "./costumeUpdateForm";

export function SelectedCostumeCard({
  costume,
  onClearSelection,
  onUpdate,
}: SelectedCostumeCardProps) {
  const updateCostumeMutation = useUpdateCostume();
  const deleteCostumeMutation = useDeleteCostume();

  const handleDelete = () => {
    deleteCostumeMutation.mutate(costume.costumeId, {
      onSuccess: () => {
        onClearSelection();
      },
    });
  };

  return (
    <SelectedCard
      title={costume.name}
      changeLabel="Выбрать другой костюм"
      deleteModalTitle="Удаление костюма"
      onClear={onClearSelection}
      onDelete={handleDelete}
      isDeleting={deleteCostumeMutation.isPending}
      renderUpdateForm={(close) => (
        <CostumeUpdateForm
          costume={costume}
          onClose={close}
          isLoading={updateCostumeMutation.isPending}
          onSave={(newName) =>
            updateCostumeMutation.mutate(
              { costumeId: costume.costumeId, data: { name: newName } },
              {
                onSuccess: (updatedData) => {
                  onUpdate(updatedData);
                  close();
                },
              },
            )
          }
        />
      )}
    />
  );
}
