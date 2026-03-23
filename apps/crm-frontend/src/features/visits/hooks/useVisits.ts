import { useMutation, useQueryClient } from "@tanstack/react-query";
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
