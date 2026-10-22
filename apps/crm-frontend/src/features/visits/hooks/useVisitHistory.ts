import { useInfiniteQuery } from "@tanstack/react-query";
import { visitHistoryService } from "../services/visitHistory.service";

export const visitHistoryKeys = {
  all: ["visits", "history"] as const,
  detail: (visitId: number) => ["visits", "history", visitId] as const,
};

export function useVisitHistory(visitId: number) {
  return useInfiniteQuery({
    queryKey: visitHistoryKeys.detail(visitId),
    queryFn: ({ pageParam }) =>
      visitHistoryService.getVisitHistory(visitId, {
        page: pageParam,
        limit: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: Number.isInteger(visitId) && visitId > 0,
  });
}
