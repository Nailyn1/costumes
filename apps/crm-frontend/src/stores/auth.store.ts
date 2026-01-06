import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { LoginSuccessResponseDto } from "@project/shared";

interface AuthState {
  user: LoginSuccessResponseDto["user"] | null;
  accessToken: string | null;
  isAuth: boolean;

  setAuth: (data: LoginSuccessResponseDto) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        accessToken: null,
        isAuth: false,

        setAuth: (data) =>
          set({
            user: data.user,
            accessToken: data.accessToken,
            isAuth: true,
          }),

        logout: () =>
          set({
            user: null,
            accessToken: null,
            isAuth: false,
          }),
      }),
      { name: "auth-storage" }
    )
  )
);
