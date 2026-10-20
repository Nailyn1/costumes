import { AxiosError, AxiosHeaders, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { TypedStatusError } from "@costumes/shared";
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
          if (refreshError instanceof TypedStatusError) {
            const statusResponse = refreshError.response;
            const responseHeaders = new AxiosHeaders();
            for (const name of ["content-type", "set-cookie"]) {
              const value = statusResponse.headers.get(name);
              if (value) responseHeaders.set(name, value);
            }
            return Promise.reject(
              new AxiosError(
                refreshError.message,
                "ERR_BAD_RESPONSE",
                originalRequest,
                undefined,
                {
                  ...statusResponse,
                  config: originalRequest,
                  headers: responseHeaders,
                } as AxiosResponse,
              ),
            );
          }
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    },
  );
};
