import { createApiClient } from "@project/shared";
import { api, API_BASE_URL } from "./api";

export const apiClient = createApiClient(API_BASE_URL, {
  axiosInstance: api,
});
