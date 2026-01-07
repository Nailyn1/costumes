import { useNavigate } from "react-router-dom";
import { useAuthStore } from "src/stores/auth.store";
import { authService } from "src/features/auth/services/auth.service";
import { useCallback } from "react";

export const useLogout = () => {
  const navigate = useNavigate();
  const logoutFromStore = useAuthStore((s) => s.logout);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      logoutFromStore();
      navigate("/login", { replace: true });
    }
  }, [logoutFromStore, navigate]);

  return { logout };
};
