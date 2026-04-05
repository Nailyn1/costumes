import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { visitsService } from "../services/visits.service";
import { socket } from "src/services/socket.client";

interface SocketResponse {
  status: "success" | "error";
}

const emitAsync = <T>(event: string, payload: T): Promise<SocketResponse> => {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error("Нет соединения с сервером"));
      return;
    }

    // Установим таймаут, чтобы лоадер не крутился вечно, если бэкенд молчит
    const timeout = setTimeout(() => {
      reject(new Error("Превышено время ожидания ответа от сервера"));
    }, 5000);

    socket.emit(event, payload, (response: SocketResponse) => {
      clearTimeout(timeout);
      if (response.status === "success") {
        resolve(response);
      } else {
        reject(new Error("Ошибка сервера"));
      }
    });
  });
};

export function useResendNotification() {
  return useMutation({
    mutationFn: (notificationId: number) =>
      emitAsync("resend_notification", { notificationId }),
  });
}

export function useUpdatePhoneAndResend() {
  return useMutation({
    mutationFn: (data: { notificationId: number; newPhone: string }) =>
      emitAsync("update_phone_and_resend", data),
  });
}

export function useShowNotification(enabled = true) {
  return useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) =>
      visitsService.getVisitsNotification({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
