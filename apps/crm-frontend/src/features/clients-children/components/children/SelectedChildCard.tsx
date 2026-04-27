import { SelectedCard } from "src/components/selection/SelectedCard";
import { useUpdateChild, useDeleteChild } from "../../hooks/useChild";
import type {
  SelectedChild,
  SelectedClientData,
} from "../../types/clientTypes";
import { ChildUpdateForm } from "./ChildUpdateForm";
import { useQueryClient } from "@tanstack/react-query";
import { clientKeys } from "../../hooks/useClients";

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
  const queryClient = useQueryClient();

  const handleDelete = () => {
    deleteChildMutation.mutate(
      { childId: child.childId, clientId },
      {
        onSuccess: () => {
          const formKey = clientKeys.formState(clientId.toString());

          queryClient.setQueryData<SelectedClientData>(formKey, (oldData) => {
            if (!oldData || !oldData.children) return oldData;

            return {
              ...oldData,
              children: oldData.children.filter(
                (c) => c.childId !== child.childId,
              ),
            };
          });

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
              {
                onSuccess: () => {
                  const formKey = clientKeys.formState(clientId.toString());

                  queryClient.setQueryData<SelectedClientData>(
                    formKey,
                    (oldData) => {
                      if (!oldData || !oldData.children) return oldData;
                      return {
                        ...oldData,
                        children: oldData.children.map((c) =>
                          c.childId === child.childId
                            ? { ...c, name: newName }
                            : c,
                        ),
                      };
                    },
                  );

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
