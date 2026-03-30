import {
  Button,
  Paper,
  Text,
  Stack,
  Divider,
  Group,
  Avatar,
  Box,
} from "@mantine/core";
import { useAuthStore } from "src/stores/auth.store";
import { useLogout } from "../hooks/useLogout";
import { IconLogout, IconUserShield } from "@tabler/icons-react";

export function ProfileForm() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useLogout();

  return (
    <Stack gap="md">
      <Paper radius="md" p="xl" withBorder shadow="sm">
        <Stack gap="xl">
          <Group justify="space-between" align="center">
            <Group gap="lg">
              <Avatar
                color="blue"
                size="xl"
                radius="xl"
                variant="light"
                style={{ border: "2px solid var(--mantine-color-blue-1)" }}
              >
                {user?.login?.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Text size="xl" fw={800} style={{ lineHeight: 1 }}>
                  {user?.login || "Пользователь"}
                </Text>
                <Group gap={4} mt={8}>
                  <IconUserShield
                    size={14}
                    color="var(--mantine-color-dimmed)"
                  />
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Сотрудник
                  </Text>
                </Group>
              </Box>
            </Group>
          </Group>

          <Divider variant="dashed" />
          <Button
            fullWidth
            variant="light"
            color="red"
            onClick={logout}
            leftSection={<IconLogout size={18} />}
            size="md"
          >
            Выйти из системы
          </Button>
        </Stack>
      </Paper>

      <Text size="xs" c="dimmed" ta="center">
        ID пользователя: {user?.id ? String(user.id) : "---"} • Последний вход:{" "}
        {new Date().toLocaleDateString()}
      </Text>
    </Stack>
  );
}
