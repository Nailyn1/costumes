import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  UpdateReservedVisitRequestDto,
  VisitListQueryDto,
} from "@costumes/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { visitReadsService } from "../services/visitReads.service";
import { visitHistoryKeys } from "./useVisitHistory";

export const visitReadKeys = {
  listPrefix: () => ["visits", "read-list"] as const,
  lists: () => ["visits", "read-list"] as const,
  list: (params: VisitListQueryDto) => ["visits", "read-list", params] as const,
  detailPrefix: () => ["visit", "detail"] as const,
  detail: (visitId: number | null) => ["visit", "detail", visitId] as const,
};

export function useVisitList(params: VisitListQueryDto) {
  return useQuery({
    queryKey: visitReadKeys.list(params),
    queryFn: () => visitReadsService.getVisits(params),
    placeholderData: keepPreviousData,
  });
}

export function useVisitReadDetail(visitId: number | null) {
  return useQuery({
    queryKey: visitReadKeys.detail(visitId),
    queryFn: () => {
      if (visitId === null) throw new Error("visitId обязателен для запроса визита");
      return visitReadsService.getVisitDetail(visitId);
    },
    enabled: visitId !== null,
  });
}

export function useUpdateReservedVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      visitId,
      body,
    }: {
      visitId: number;
      body: UpdateReservedVisitRequestDto;
    }) => visitReadsService.updateReservedVisit(visitId, body),
    onSuccess: (_, { visitId }) => {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["visit"] });
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      queryClient.invalidateQueries({ queryKey: visitReadKeys.listPrefix() });
      queryClient.invalidateQueries({ queryKey: visitReadKeys.detailPrefix() });
      queryClient.invalidateQueries({ queryKey: visitHistoryKeys.detail(visitId) });
      notifications.show({
        title: "Изменения сохранены",
        message: "Данные визита обновлены",
        color: "green",
        position: "top-right",
      });
    },
  });
}
