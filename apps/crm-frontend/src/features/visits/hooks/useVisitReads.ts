import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { VisitListQueryDto } from "@costumes/shared";
import { visitReadsService } from "../services/visitReads.service";

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
