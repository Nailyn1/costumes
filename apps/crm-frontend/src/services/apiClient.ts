import { createApiClient } from "@project/shared";
import { api, API_BASE_URL, authApi } from "./api";

export const apiClient = createApiClient(API_BASE_URL, {
  axiosInstance: api,
});

export const authApiClient = createApiClient(API_BASE_URL, {
  axiosInstance: authApi,
});
