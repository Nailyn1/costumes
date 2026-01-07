import {
  Button,
  Paper,
  Text,
  Title,
  Stack,
  Divider,
  Group,
  Avatar,
} from "@mantine/core";
import { useAuthStore } from "src/stores/auth.store";
import { useLogout } from "../hooks/useLogout";

export function ProfileForm() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useLogout();

  return (
    <Paper radius="md" p="xl" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2}>Профиль</Title>
          <Avatar color="blue" radius="xl">
            {user?.login?.charAt(0).toUpperCase()}
          </Avatar>
        </Group>

        <Divider />

        <Group justify="space-between">
          <Text size="md" fw={700}>
            {user?.login || "Неизвестный пользователь"}
          </Text>
        </Group>

        <Paper
          p="md"
          bg="gray.0"
          radius="sm"
          style={{ borderStyle: "dashed", borderWidth: 1 }}
        >
          <Text size="xs" c="dimmed" ta="center">
            Блок статистики (в разработке)
          </Text>
        </Paper>

        <Button fullWidth variant="light" color="red" onClick={logout} mt="lg">
          Выйти из аккаунта
        </Button>
      </Stack>
    </Paper>
  );
}
