import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { costumeService } from "../services/costumes.service";
import type {
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
    onSuccess: (updatedCostume) => {
      queryClient.invalidateQueries({ queryKey: costumesKeys.lists() });
      queryClient.setQueryData(
        costumesKeys.detail(updatedCostume.costumeId),
        updatedCostume,
      );
    },
  });
}

export function useDeleteCostume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (costumeId: number) => costumeService.deleteCostume(costumeId),

    onSuccess: (_, costumeId) => {
      queryClient.invalidateQueries({ queryKey: costumesKeys.lists() });

      queryClient.removeQueries({ queryKey: costumesKeys.detail(costumeId) });
    },
  });
}
