import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "src/stores/auth.store";

interface PrivateRouteProps {
  children?: ReactNode;
}

export const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const isAuth = useAuthStore((s) => s.isAuth);

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
