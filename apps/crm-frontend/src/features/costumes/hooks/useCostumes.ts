import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { costumeService } from "../services/costumes.service";
import type {
  CostumesListResponseDto,
  CreateCostumesRequestDto,
  UpdateCostumesRequestDto,
} from "@costumes/shared";

export const costumesKeys = {
  all: ["costumes"] as const,
  lists: () => [...costumesKeys.all, "list"] as const,
  search: (query: string) =>
    [...costumesKeys.lists(), "search", query] as const,
  detail: (id: number | string) =>
    [...costumesKeys.all, "detail", id.toString()] as const,
};

export function useSearchAvailableCostumes(
  searchQuery: string,
  startDate: string,
  endDate: string,
) {
  return useQuery({
    queryKey: [...costumesKeys.search(searchQuery), startDate, endDate],
    queryFn: () =>
      costumeService.searchAvailableCostumes(searchQuery, startDate, endDate),
    enabled: searchQuery.trim().length >= 2 && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateCostume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCostumesRequestDto) =>
      costumeService.createCostume(data),
    onSuccess: (newCostume) => {
      queryClient.invalidateQueries({ queryKey: costumesKeys.lists() });
      queryClient.setQueryData(
        costumesKeys.detail(newCostume.costumeId),
        newCostume,
      );
    },
  });
}

export function useUpdateCostume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      costumeId,
      data,
    }: {
      costumeId: number;
      data: UpdateCostumesRequestDto;
    }) => costumeService.updateCostume(data, costumeId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: costumesKeys.lists() });

      queryClient.invalidateQueries({
        queryKey: costumesKeys.detail(variables.costumeId),
      });
    },
  });
}

export function useDeleteCostume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (costumeId: number) => costumeService.deleteCostume(costumeId),

    onSuccess: (_, costumeId) => {
      queryClient.removeQueries({ queryKey: costumesKeys.detail(costumeId) });

      queryClient.setQueriesData(
        { queryKey: costumesKeys.lists() },
        (oldData: InfiniteData<CostumesListResponseDto>) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.costumeId !== costumeId),
            })),
          };
        },
      );

      queryClient.invalidateQueries({ queryKey: costumesKeys.lists() });
    },
  });
}

export function useSearchCostume(searchQuery: string) {
  return useQuery({
    queryKey: [...costumesKeys.search(searchQuery)],
    queryFn: () => costumeService.searchCostumes(searchQuery),
    enabled: searchQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });
}

export function useIsAvailableCostume(
  costumeId: number,
  isModalOpened: boolean = true,
) {
  return useQuery({
    queryKey: [...costumesKeys.detail(costumeId)],
    queryFn: () => {
      if (!costumeId) {
        throw new Error("costumeId обязателен для выполнения запроса");
      }
      return costumeService.isAvailableCostume(costumeId);
    },
    enabled: !!costumeId && isModalOpened,
  });
}

export function useCostumeList(enabled = true) {
  return useInfiniteQuery({
    queryKey: [...costumesKeys.lists()],
    queryFn: ({ pageParam }) =>
      costumeService.getCostumesList({ page: pageParam }),
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
