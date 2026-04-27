import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { clientsService } from "../services/clients.service.";
import type {
  AddClientInBlackListRequestDto,
  CreateClientRequestDto,
  UpdateClientRequestDto,
} from "@costumes/shared";
import type { SelectedClientData } from "../types/clientTypes";

export const clientKeys = {
  all: ["clients"] as const,
  lists: () => [...clientKeys.all, "list"] as const,
  search: (query: string) => [...clientKeys.lists(), "search", query] as const,
  formState: (id: string) => [...clientKeys.all, "formState", id] as const,
  detail: (id: number | string | null) =>
    [...clientKeys.all, "detail", id ? id.toString() : "empty"] as const,
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
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });

      queryClient.invalidateQueries({
        queryKey: clientKeys.detail(variables.clientId),
      });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: number) => clientsService.deleteClient(clientId),

    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });

      queryClient.setQueryData(clientKeys.detail(clientId), null);

      queryClient.removeQueries({
        queryKey: clientKeys.formState(clientId.toString()),
      });
    },
  });
}

export function useClient(clientId: number | string | null) {
  return useQuery<SelectedClientData | null>({
    queryKey: clientKeys.formState(clientId?.toString() || ""),
    enabled: !!clientId,
    staleTime: Infinity,
    queryFn: () => null,
  });
}

export function useClientsList(enabled = true) {
  return useInfiniteQuery({
    queryKey: [...clientKeys.lists()],
    queryFn: ({ pageParam }) =>
      clientsService.getClientsList({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    enabled,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useDetailedClient(clientId: number) {
  return useQuery({
    queryKey: clientKeys.detail(clientId),
    queryFn: () => clientsService.getDetaileClient(clientId),
    enabled: !!clientId,
  });
}

export function useAddClientToBlacklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clientId,
      data,
    }: {
      clientId: number;
      data: AddClientInBlackListRequestDto;
    }) => clientsService.addClientInBlacklist(clientId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: clientKeys.detail(variables.clientId),
      });
    },
  });
}

export function useRemoveClientFromBlacklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: number) =>
      clientsService.removeClientFromBlacklist(clientId),
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: clientKeys.detail(clientId),
      });
    },
  });
}
