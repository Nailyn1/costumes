import {
  Button,
  Paper,
  Text,
  Stack,
  Divider,
  Group,
  Avatar,
  Box,
  SimpleGrid,
  ThemeIcon,
} from "@mantine/core";
import { useAuthStore } from "src/stores/auth.store";
import { useLogout } from "../hooks/useLogout";
import {
  IconLogout,
  IconShirt,
  IconRotateClockwise2,
  IconUserShield,
} from "@tabler/icons-react";

export function ProfileForm() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useLogout();

  return (
    <Stack gap="md">
      <Paper radius="md" p="xl" withBorder shadow="sm">
        <Stack gap="xl">
          {/* Заголовок профиля */}
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

          {/* Блок статистики (заглушка с дизайном) */}
          <Box>
            <Text size="sm" fw={700} mb="md">
              Ваша активность сегодня:
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Paper withBorder p="sm" radius="md" bg="gray.0">
                <Group>
                  <ThemeIcon color="green" variant="light" size="lg">
                    <IconShirt size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Выдано костюмов
                    </Text>
                    <Text fw={700}>12</Text>
                  </Box>
                </Group>
              </Paper>

              <Paper withBorder p="sm" radius="md" bg="gray.0">
                <Group>
                  <ThemeIcon color="orange" variant="light" size="lg">
                    <IconRotateClockwise2 size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Принято возвратов
                    </Text>
                    <Text fw={700}>0</Text>
                  </Box>
                </Group>
              </Paper>
            </SimpleGrid>
          </Box>

          <Divider variant="dashed" />

          {/* Действия */}
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
