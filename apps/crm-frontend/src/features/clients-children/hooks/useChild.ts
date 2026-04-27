import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsService } from "../services/clients.service.";
import { clientKeys } from "./useClients";
import type { CreateChildRequestDto } from "@costumes/shared";

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
    onSuccess: (newChild) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });

      queryClient.invalidateQueries({
        queryKey: clientKeys.detail(newChild.clientId.toString()),
      });
    },
  });
}

export function useUpdateChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ childId, name }: UpdateChildVariables) =>
      clientsService.updateChild({ name }, childId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: clientKeys.detail(variables.clientId.toString()),
      });
    },
  });
}

export function useDeleteChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ childId }: DeleteChildVariables) =>
      clientsService.deleteChild(childId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: clientKeys.detail(variables.clientId.toString()),
      });
    },
  });
}
