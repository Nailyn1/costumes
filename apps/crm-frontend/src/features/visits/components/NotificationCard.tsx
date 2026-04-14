import { useState } from "react";
import {
  Paper,
  Text,
  Group,
  Badge,
  Menu,
  ActionIcon,
  Modal,
  Button,
  Stack,
  Divider,
  Box,
  InputBase,
} from "@mantine/core";
import { IconDotsVertical, IconRefresh, IconEdit } from "@tabler/icons-react";
import {
  useResendNotification,
  useUpdatePhoneAndResend,
} from "src/features/visits/hooks/useNotifications";
import type { visitNotificationResponseDto } from "@costumes/shared";
import { formatPhoneNumber } from "src/utills/formatters";
import { IMaskInput } from "react-imask";
import z from "zod";

const statusColors: Record<string, string> = {
  pending: "orange",
  sent: "gray",
  delivered: "blue",
  failed: "red",
  read: "teal",
  isConfirmed: "green",
};

const statusLabels: Record<string, string> = {
  pending: "В очереди",
  sent: "Отправлено",
  delivered: "Доставлено",
  failed: "Ошибка",
  isConfirmed: "Подтверждено",
  read: "Прочитано",
  noAccount: "Нет WhatsApp",
};

const phoneSchema = z
  .string()
  .regex(/^\+7\d{10}$/, "Номер должен содержать 10 цифр после +7");

export function NotificationCard({
  item,
}: {
  item: visitNotificationResponseDto["items"][number];
}) {
  const [isModalOpened, setIsModalOpened] = useState(false);
  const [phoneInput, setPhoneInput] = useState(item.clientPhone);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const resendMutation = useResendNotification();
  const updatePhoneMutation = useUpdatePhoneAndResend();

  const handleResend = () => {
    resendMutation.mutate(item.notificationId);
  };

  const handleUpdatePhone = () => {
    const cleanPhone = phoneInput.replace(/[^\d+]/g, "");

    const result = phoneSchema.safeParse(cleanPhone);

    if (!result.success) {
      setPhoneError(result.error.errors[0].message);
      return;
    }

    setPhoneError(null);
    updatePhoneMutation.mutate(
      { notificationId: item.notificationId, newPhone: result.data },
      {
        onSuccess: () => setIsModalOpened(false),
      },
    );
  };

  const isPending = resendMutation.isPending || updatePhoneMutation.isPending;

  return (
    <>
      <Paper shadow="sm" p="md" radius="md" withBorder>
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Badge
              size="lg"
              color={statusColors[item.status] || "gray"}
              variant="light"
            >
              {statusLabels[item.status] || item.status}
            </Badge>

            <Menu position="bottom-end" shadow="sm">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" loading={isPending}>
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconRefresh size={16} />}
                  onClick={handleResend}
                >
                  Переотправить SMS
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconEdit size={16} />}
                  onClick={() => setIsModalOpened(true)}
                >
                  Изменить номер и отправить
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          <Divider my="sm" />

          <Box>
            <Group gap="xs" mb={4}>
              <Text size="md" c="dimmed">
                Визит:
              </Text>
              <Badge variant="filled" color="blue" size="lg" radius="sm">
                #{item.visitCode}
              </Badge>
            </Group>
            <Text size="lg" fw={600}>
              {item.clientName}
            </Text>
            <Text size="sm" c="dimmed" style={{ letterSpacing: "0.5px" }}>
              {formatPhoneNumber(item.clientPhone)}
            </Text>
          </Box>

          <Box mt="sm">
            <Text size="lg">{item.childrenNames}</Text>
            <Text size="lg" c="dimmed">
              {item.costumeNames}
            </Text>
          </Box>
        </Stack>
      </Paper>

      <Modal
        opened={isModalOpened}
        onClose={() => {
          setIsModalOpened(false);
          setPhoneError(null);
        }}
        title="Изменить номер телефона"
        centered
        radius="md"
      >
        <Stack>
          <InputBase
            component={IMaskInput}
            mask="+7 (000) 000-00-00"
            label="Номер телефона WhatsApp"
            placeholder="+7 (777) 000-00-00"
            value={phoneInput}
            type="tel"
            inputMode="tel"
            onAccept={(value: string) => {
              setPhoneInput(value);
              if (phoneError) setPhoneError(null);
            }}
            error={phoneError}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setIsModalOpened(false)}
            >
              Отмена
            </Button>
            <Button
              onClick={handleUpdatePhone}
              loading={updatePhoneMutation.isPending}
              color="blue"
            >
              Изменить и отправить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
