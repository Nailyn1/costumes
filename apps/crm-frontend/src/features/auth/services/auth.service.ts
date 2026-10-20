import { apiClient } from "src/services/apiClient";
import type {
  LoginRequestDto,
  LoginSuccessResponseDto,
  RefreshSuccessResponseDto,
} from "@costumes/shared";

export const authService = {
  login(data: LoginRequestDto): Promise<LoginSuccessResponseDto> {
    return apiClient.post("/auth/login", { body: data });
  },

  logout() {
    return apiClient.post("/auth/logout");
  },

  refresh(): Promise<RefreshSuccessResponseDto> {
    return apiClient.post("/auth/refresh", {
      header: {
        Cookie: "",
      },
    });
  },
};
