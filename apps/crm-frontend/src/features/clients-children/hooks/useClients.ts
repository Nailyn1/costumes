import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsService } from "../services/clients.service.";
import type {
  CreateClientRequestDto,
  UpdateClientRequestDto,
} from "@costumes/shared";
import type { SelectedClientData } from "../types/clientTypes";

export const clientKeys = {
  all: ["clients"] as const,
  lists: () => [...clientKeys.all, "list"] as const,
  search: (query: string) => [...clientKeys.lists(), "search", query] as const,
  detail: (id: number | string) =>
    [...clientKeys.all, "detail", id.toString()] as const,
};

export function useSearchClients(searchQuery: string) {
  return useQuery({
    queryKey: clientKeys.search(searchQuery),
    queryFn: () => clientsService.searchClients(searchQuery),
    enabled: searchQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateClientRequestDto) =>
      clientsService.createClient(data),
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.setQueryData(
        clientKeys.detail(newClient.clientId),
        newClient,
      );
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clientId,
      data,
    }: {
      clientId: number;
      data: UpdateClientRequestDto;
    }) => clientsService.updateClient(data, clientId),
    onSuccess: (updatedClient) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.setQueryData(
        clientKeys.detail(updatedClient.clientId),
        updatedClient,
      );
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: number) => clientsService.deleteClient(clientId),

    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });

      queryClient.removeQueries({ queryKey: clientKeys.detail(clientId) });
    },
  });
}

export function useClient(clientId: number | string | null) {
  return useQuery<SelectedClientData | null>({
    queryKey: clientKeys.detail(clientId?.toString() || ""),
    enabled: !!clientId,
    staleTime: Infinity,
    queryFn: () => null,
  });
}
