import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  visitsService,
  type GetReservedParams,
} from "../services/visits.service";
import type {
  CreateVisitRequestDto,
  GetVisitReservedDto,
  visitCancelRequestDto,
  visitCompleteReturnRequestDto,
  visitIssuedRepsonseDto,
  VisitIssueRequestDto,
} from "@costumes/shared";
import { notifications } from "@mantine/notifications";

export function useVisitPreviewCode() {
  return useMutation({
    mutationFn: () => visitsService.getPreviewCode(),
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVisitRequestDto) =>
      visitsService.createVisit(data),
    onSuccess: () => {
      notifications.show({
        title: "Успех!",
        message: "Визит успешно создан",
        color: "green",
        position: "top-right",
      });
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
    },
  });
}

export function useNotWrittenCostumes() {
  return useQuery({
    queryKey: ["visits", "not-written"],
    queryFn: async () => {
      const response = await visitsService.getVisitNotWritten();
      return response?.items ?? [];
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 4000,
    meta: {
      silent: true,
    },
  });
}

export function useMarkCostumeAsWritten() {
  return useMutation({
    mutationFn: (orderId: number) => visitsService.markTagVisitWritten(orderId),
  });
}

type UseReservedVisitsFilters = Omit<GetReservedParams, "page">;

export function useReservedVisits(
  filters: UseReservedVisitsFilters = {},
  enabled: boolean = true,
) {
  return useInfiniteQuery({
    queryKey: ["visits", "reserved", filters],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await visitsService.getVisitsReserved({
        ...filters,
        page: pageParam,
        limit: 20,
      });
      return response;
    },

    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    enabled,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}

export function useVisitForIssue(visitId: number | null) {
  return useQuery({
    queryKey: ["visit", "for-issue", visitId],
    queryFn: () => {
      if (!visitId) {
        throw new Error("visitId обязателен для выполнения запроса");
      }
      return visitsService.getVisitForIssue(visitId);
    },
    enabled: !!visitId,
  });
}

export function useIssueVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      visitId,
      data,
    }: {
      visitId: number;
      data: VisitIssueRequestDto;
    }) => visitsService.issueVisit(data, visitId),
    onSuccess: (_, variables) => {
      queryClient.setQueriesData(
        { queryKey: ["visits", "reserved"] },
        (oldData: InfiniteData<GetVisitReservedDto> | undefined) => {
          if (!oldData || !oldData.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.filter(
                (item) => item.visitId !== variables.visitId,
              ),
            })),
          };
        },
      );
      queryClient.removeQueries({
        queryKey: ["visit", "for-issue", variables.visitId],
      });
      notifications.show({
        title: "Успешно",
        message: "Заказ успешно выданы клиенту!",
        color: "green",
      });
    },
  });
}

export function useCancelVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      visitId,
      data,
    }: {
      visitId: number;
      data: visitCancelRequestDto;
    }) => visitsService.cancelVisit(data, visitId),

    onSuccess: (_, variables) => {
      queryClient.setQueriesData(
        { queryKey: ["visits", "reserved"] },
        (oldData: InfiniteData<GetVisitReservedDto> | undefined) => {
          if (!oldData || !oldData.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.filter(
                (item) => item.visitId !== variables.visitId,
              ),
            })),
          };
        },
      );

      queryClient.removeQueries({
        queryKey: ["visit", "for-issue", variables.visitId],
      });
      notifications.show({
        title: "Визит отменен",
        message: "",
        color: "teal",
      });
    },
  });
}

export function useSearchVisits(searchQuery: string) {
  return useQuery({
    queryKey: ["visits", "search", "reserved", searchQuery],
    queryFn: () => visitsService.searchVisits(searchQuery),
    enabled: searchQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });
}

export function useIssuedVisits(enabled = true) {
  return useInfiniteQuery({
    queryKey: ["visits", "issued"],
    queryFn: ({ pageParam }) =>
      visitsService.getIssuedVisits({ page: pageParam }),
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

export function useVisitForReturn(visitId: number | null) {
  return useQuery({
    queryKey: ["visit", "for-return", visitId],
    queryFn: () => {
      if (!visitId) {
        throw new Error("visitId обязателен для выполнения запроса");
      }
      return visitsService.getVisitForReturn(visitId);
    },
    enabled: !!visitId,
  });
}

export function useCompleteReturnVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      visitId,
      data,
    }: {
      visitId: number;
      data: visitCompleteReturnRequestDto;
    }) => visitsService.completeReturnVisit(data, visitId),

    onSuccess: (_, variables) => {
      queryClient.setQueriesData<InfiniteData<visitIssuedRepsonseDto>>(
        { queryKey: ["visits", "issued"] },
        (oldData) => {
          if (!oldData || !oldData.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.filter(
                (item) => item.visitId !== variables.visitId,
              ),
            })),
          };
        },
      );

      queryClient.removeQueries({
        queryKey: ["visit", "for-return", variables.visitId],
      });

      notifications.show({
        title: "Возврат оформлен",
        message: "",
        color: "green",
      });
    },
  });
}

export function useSearchIssuedVisits(searchQuery: string) {
  return useQuery({
    queryKey: ["visits", "search", "issued", searchQuery],
    queryFn: () => visitsService.returnSearchVisits(searchQuery),
    enabled: searchQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });
}

export function useUnreturnedDeposits(enabled = true) {
  return useInfiniteQuery({
    queryKey: ["visits", "unreturned-deposits"],
    queryFn: ({ pageParam }) =>
      visitsService.getUnreturnedDeposits({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useMarkDepositReturned() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitId, notes }: { visitId: number; notes: string }) =>
      visitsService.markDepositReturned(notes, visitId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["visits", "unreturned-deposits"],
      });
      notifications.show({
        title: "Залог возвращён",
        message: "",
        color: "green",
      });
    },
  });
}
