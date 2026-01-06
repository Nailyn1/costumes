import { apiClient } from "src/services/apiClient";
import type {
  LoginRequestDto,
  LoginSuccessResponseDto,
  RefreshSuccessResponseDto,
} from "@project/shared";

export const authService = {
  login(data: LoginRequestDto): Promise<LoginSuccessResponseDto> {
    return apiClient.AuthOperations_login(data);
  },

  logout() {
    return apiClient.AuthOperations_logout(undefined);
  },

  refresh(): Promise<RefreshSuccessResponseDto> {
    return apiClient.AuthOperations_refresh(undefined, {
      headers: {
        Cookie: document.cookie,
      },
    });
  },
};
