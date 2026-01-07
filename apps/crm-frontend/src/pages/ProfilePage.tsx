import { Container, Center } from "@mantine/core";
import { ProfileForm } from "src/features/auth/components/ProfileForm";

export function ProfilePage() {
  return (
    <Center h="100vh">
      <Container size="xs" mt={40}>
        <ProfileForm />
      </Container>
    </Center>
  );
}
