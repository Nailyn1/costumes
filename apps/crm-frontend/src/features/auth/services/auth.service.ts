import { authApiClient } from "src/services/apiClient";
import type {
  LoginRequestDto,
  LoginSuccessResponseDto,
  RefreshSuccessResponseDto,
} from "@project/shared";

export const authService = {
  login(data: LoginRequestDto): Promise<LoginSuccessResponseDto> {
    return authApiClient.AuthOperations_login(data);
  },

  logout() {
    return authApiClient.AuthOperations_logout(undefined);
  },

  refresh(): Promise<RefreshSuccessResponseDto> {
    return authApiClient.AuthOperations_refresh(undefined, {
      headers: {
        Cookie: "",
      },
    });
  },
};
