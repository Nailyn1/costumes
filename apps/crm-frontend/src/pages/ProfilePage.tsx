import { Container, Stack, Title, Text } from "@mantine/core";
import { ProfileForm } from "src/features/auth/components/ProfileForm";
import { useMediaQuery } from "@mantine/hooks";

export function ProfilePage() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={isMobile ? 3 : 2}>Личный кабинет</Title>
          <Text size="sm" c="dimmed">
            Управление аккаунтом и статистика работы
          </Text>
        </Stack>

        <ProfileForm />
      </Stack>
    </Container>
  );
}
