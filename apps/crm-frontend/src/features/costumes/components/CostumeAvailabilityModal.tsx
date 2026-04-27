import { useState } from "react";
import {
  Modal,
  Stack,
  Divider,
  Paper,
  Group,
  Box,
  Text,
  Badge,
  Alert,
  Button,
  Center,
  Loader,
  Title,
  Menu,
  ActionIcon,
} from "@mantine/core";
import {
  IconUser,
  IconPhone,
  IconInfoCircle,
  IconClock,
  IconEdit,
  IconTrash,
  IconHanger,
  IconDotsVertical,
} from "@tabler/icons-react";
import {
  useIsAvailableCostume,
  useUpdateCostume,
  useDeleteCostume,
} from "../hooks/useCostumes";
import { formatPhoneNumber, formatStayDates } from "src/utills/formatters";
import { CostumeUpdateForm } from "../components/costumeUpdateForm";

interface CostumeAvailabilityModalProps {
  opened: boolean;
  onClose: () => void;
  costumeId: number | null;
}

export function CostumeAvailabilityModal({
  opened,
  onClose,
  costumeId,
}: CostumeAvailabilityModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { data, isLoading, isError } = useIsAvailableCostume(
    costumeId!,
    opened,
  );
  const updateMutation = useUpdateCostume();
  const deleteMutation = useDeleteCostume();

  const handleClose = () => {
    setIsEditing(false);
    setIsDeleteModalOpen(false);
    onClose();
  };

  const handleUpdateName = (newName: string) => {
    if (!costumeId) return;
    updateMutation.mutate(
      { costumeId, data: { name: newName } },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!costumeId) return;
    deleteMutation.mutate(costumeId, {
      onSuccess: () => {
        handleClose();
      },
    });
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleClose}
        size="lg"
        title={
          <Group gap="xs">
            <IconHanger size={20} color="var(--mantine-color-blue-6)" />
            <Text fw={700}>
              {data ? `Костюм ${data.inventoryCode}` : "Загрузка..."}
            </Text>
          </Group>
        }
      >
        {isLoading && (
          <Center p="xl">
            <Loader />
          </Center>
        )}

        {isError && (
          <Alert color="red" title="Ошибка">
            Не удалось загрузить данные о занятости. Костюм мог быть удален.
          </Alert>
        )}

        {data && (
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              {isEditing ? (
                <Box style={{ flexGrow: 1 }}>
                  <CostumeUpdateForm
                    costume={{
                      costumeId: costumeId!,
                      name: data.name,
                      inventoryCode: data.inventoryCode,
                    }}
                    onSave={handleUpdateName}
                    onClose={() => setIsEditing(false)}
                    isLoading={updateMutation.isPending}
                  />
                </Box>
              ) : (
                <>
                  <Title order={3} style={{ wordBreak: "break-word" }}>
                    {data.name}
                  </Title>

                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" size="lg">
                        <IconDotsVertical size={20} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconEdit size={16} />}
                        onClick={() => setIsEditing(true)}
                      >
                        Изменить название
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={16} />}
                        onClick={() => setIsDeleteModalOpen(true)}
                      >
                        Удалить костюм
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </>
              )}
            </Group>

            <Divider label="Периоды бронирования" labelPosition="center" />

            {data.periods && data.periods.length > 0 ? (
              data.periods.map((period, index) => (
                <Paper key={index} withBorder p="md" radius="md" bg="gray.0">
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start">
                      <Box>
                        <Group gap={4} mb={2}>
                          <IconUser size={14} color="gray" />
                          <Text fw={700} size="lg">
                            {period.clientName}
                          </Text>
                        </Group>
                        <Group gap={4}>
                          <IconPhone size={14} color="gray" />
                          <Text size="md" c="dimmed">
                            {formatPhoneNumber(period.clientPhone)}
                          </Text>
                        </Group>
                      </Box>
                      <Badge variant="outline" size="lg">
                        Визит: {period.visitCode}
                      </Badge>
                    </Group>

                    <Box
                      p="xs"
                      bg="blue.0"
                      style={{
                        borderRadius: "8px",
                        borderLeft: "4px solid var(--mantine-color-blue-6)",
                      }}
                    >
                      <Group gap={6} mb={6}>
                        <Text size="md" fw={700}>
                          {period.childName}:
                        </Text>
                        <Text size="md" fw={600}>
                          {formatStayDates(
                            period.startDateTime,
                            period.endDateTime,
                          )}
                        </Text>
                      </Group>

                      <Group justify="space-between">
                        <Group gap={4} c="blue.8">
                          <IconClock size={14} />
                          <Text size="sm" fw={700}>
                            Выдача в {period.issueTimeFrom}
                          </Text>
                        </Group>

                        <Group gap={4} c="blue.8">
                          <IconClock size={14} />
                          <Text size="sm" fw={700}>
                            Возврат до {period.returnTimeUntil}
                          </Text>
                        </Group>
                      </Group>
                    </Box>
                  </Stack>
                </Paper>
              ))
            ) : (
              <Alert
                icon={<IconInfoCircle size={18} />}
                color="gray"
                variant="light"
              >
                {data.noPeriodsMessage || "Костюм полностью свободен"}
              </Alert>
            )}

            {!isEditing && (
              <Button
                fullWidth
                variant="filled"
                color="blue"
                onClick={handleClose}
                size="md"
                mt="md"
              >
                Понятно
              </Button>
            )}
          </Stack>
        )}
      </Modal>

      <Modal
        opened={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={<Text fw={700}>Удаление костюма</Text>}
        centered
        zIndex={300}
      >
        <Text size="sm" mb="lg">
          Вы уверены, что хотите удалить <b>{data?.name}</b>? Это действие
          нельзя отменить.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setIsDeleteModalOpen(false)}>
            Отмена
          </Button>
          <Button
            color="red"
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            Удалить навсегда
          </Button>
        </Group>
      </Modal>
    </>
  );
}
