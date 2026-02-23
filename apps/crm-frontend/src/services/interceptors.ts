import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "src/stores/auth.store";
import { authService } from "src/features/auth/services/auth.service";
import { notifications } from "@mantine/notifications";

export const setupInterceptors = (instance: AxiosInstance) => {
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = useAuthStore.getState().accessToken;

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const method = config.method?.toLowerCase();
      if (
        ["post", "put", "patch"].includes(method || "") &&
        !config.headers["X-Idempotency-Key"]
      ) {
        config.headers["X-Idempotency-Key"] = crypto.randomUUID();
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      const status = error.response?.status;
      const isAuthPath = originalRequest?.url?.includes("/auth/");

      console.log(
        "Status:",
        status,
        "URL:",
        originalRequest?.url,
        "Is Login:",
        isAuthPath,
      );

      if (
        status === 401 &&
        !isAuthPath &&
        originalRequest &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;

        try {
          const { accessToken } = await authService.refresh();

          useAuthStore.getState().setAccessToken(accessToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }

          return instance(originalRequest);
        } catch (refreshError) {
          useAuthStore.getState().logout();
          return Promise.reject(refreshError);
        }
      }

      if (error.response?.status !== 401 || isAuthPath) {
        const serverMessage = error.response?.data?.message;
        const errorMessage = Array.isArray(serverMessage)
          ? serverMessage[0]
          : serverMessage || "Что-то пошло не так";

        notifications.show({
          title: "Ошибка",
          message: errorMessage,
          color: "red",
          autoClose: 5000,
        });
      }

      return Promise.reject(error);
    },
  );
};
