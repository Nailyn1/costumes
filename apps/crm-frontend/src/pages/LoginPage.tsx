import { Center, Container } from "@mantine/core";
import { LoginForm } from "src/features/auth/components/LoginForm";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "src/stores/auth.store";

export function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuth);

  if (isAuthenticated) {
    return <Navigate to="/example" replace />;
  }

  return (
    <Center h="100vh">
      <Container size={420}>
        <LoginForm />
      </Container>
    </Center>
  );
}
