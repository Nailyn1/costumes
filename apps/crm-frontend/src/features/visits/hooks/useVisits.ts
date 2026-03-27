import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { visitsService } from "../services/visits.service";
import type { CreateVisitRequestDto } from "@costumes/shared";
import { notifications } from "@mantine/notifications";

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}
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
    onError: (error: ApiError) => {
      notifications.show({
        title: "Ошибка",
        message: error?.response?.data?.message || "Не удалось создать визит",
        color: "red",
        position: "top-right",
      });
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
