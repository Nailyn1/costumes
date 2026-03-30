import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "src/stores/auth.store";
import { authService } from "src/features/auth/services/auth.service";

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
      return Promise.reject(error);
    },
  );
};
