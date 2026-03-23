import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsService } from "../services/clients.service.";
import { clientKeys } from "./useClients";
import type { SelectedChild, SelectedClientData } from "../types/clientTypes";
import type {
  CreateChildRequestDto,
  CreateChildResponsetDto,
  UpdateChildResponseDto,
} from "@costumes/shared";

interface UpdateChildVariables {
  clientId: number;
  childId: number;
  name: string;
}
interface DeleteChildVariables {
  childId: number;
  clientId: number;
}

export function useCreateChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateChildRequestDto) =>
      clientsService.createChild(data),
    onSuccess: (newChild: CreateChildResponsetDto) => {
      const clientKey = clientKeys.detail(newChild.clientId.toString());

      queryClient.setQueryData<SelectedClientData>(clientKey, (oldData) => {
        if (!oldData) return oldData;

        const childToAdd: SelectedChild = {
          childId: newChild.childId,
          name: newChild.name,
        };

        return {
          ...oldData,
          children: oldData.children
            ? [...oldData.children, childToAdd]
            : [childToAdd],
        };
      });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useUpdateChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ childId, name }: UpdateChildVariables) =>
      clientsService.updateChild({ name }, childId),

    onSuccess: (updatedChild: UpdateChildResponseDto, variables) => {
      const clientKey = clientKeys.detail(variables.clientId.toString());

      queryClient.setQueryData<SelectedClientData>(clientKey, (oldData) => {
        if (!oldData || !oldData.children) return oldData;

        const updatedChildren = oldData.children.map((child) =>
          child.childId === updatedChild.childId
            ? { ...child, name: updatedChild.name }
            : child,
        );

        return {
          ...oldData,
          children: updatedChildren,
        };
      });

      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useDeleteChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ childId }: DeleteChildVariables) =>
      clientsService.deleteChild(childId),

    onSuccess: (_, variables) => {
      const clientKey = clientKeys.detail(variables.clientId.toString());
      queryClient.setQueryData<SelectedClientData>(clientKey, (oldData) => {
        if (!oldData || !oldData.children) return oldData;
        const updatedChildren = oldData.children.filter(
          (child) => child.childId !== variables.childId,
        );

        return {
          ...oldData,
          children: updatedChildren,
        };
      });

      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useClient(clientId: number | string | null) {
  return useQuery<SelectedClientData | null, Error>({
    queryKey: clientKeys.detail(clientId?.toString() || ""),
    enabled: !!clientId,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    initialData: undefined,
  });
}
