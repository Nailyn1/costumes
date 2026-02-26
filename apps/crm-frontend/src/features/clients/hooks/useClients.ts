import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsService } from "../services/clients.service.";
import type {
  CreateClientRequestDto,
  UpdateClientRequestDto,
} from "@costumes/shared";

export const clientKeys = {
  all: ["clients"] as const,
  search: (query: string) => [...clientKeys.all, "search", query] as const,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: number) => clientsService.deleteClient(clientId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}
