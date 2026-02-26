import { useState } from "react";
import {
  Paper,
  Group,
  Text,
  Menu,
  ActionIcon,
  Modal,
  Button,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconArrowsExchange,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { formatPhoneNumber } from "src/utills/formatters";
import type {
  SelectedClientCardProps,
  SelectedClientData,
} from "../types/clientTypes";
import { useDeleteClient } from "../hooks/useClients";
import { ClientUpdateForm } from "./clientUpdateForm";

export function SelectedClientCard({
  client,
  onClearSelection,
  onUpdate,
}: SelectedClientCardProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const deleteMutation = useDeleteClient();

  const handleDelete = () => {
    deleteMutation.mutate(Number(client.id), {
      onSuccess: () => {
        setIsDeleteModalOpen(false);
        onClearSelection();
      },
    });
  };

  const handleUpdateSuccess = (updated: SelectedClientData) => {
    setIsEditing(false);
    onUpdate(updated);
  };

  return (
    <>
      <Paper
        withBorder
        p="sm"
        radius="md"
        bg={isEditing ? "transparent" : "blue.0"}
      >
        {isEditing ? (
          <ClientUpdateForm
            client={client}
            onCancel={() => setIsEditing(false)}
            onSuccess={handleUpdateSuccess}
          />
        ) : (
          <Group justify="space-between">
            <div>
              <Text fw={500}>{client.name}</Text>
              <Text size="sm" c="dimmed">
                {formatPhoneNumber(client.phone)}
              </Text>
            </div>

            <Menu position="bottom-end" shadow="sm">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size="1.2rem" />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconArrowsExchange size={16} />}
                  onClick={onClearSelection}
                >
                  Выбрать другого
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconEdit size={16} />}
                  onClick={() => setIsEditing(true)}
                >
                  Изменить
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  Удалить
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        )}
      </Paper>

      {/* Модалка для удаления живет здесь */}
      <Modal
        opened={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Удаление клиента"
        centered
      >
        <Text size="sm" mb="lg">
          Вы уверены, что хотите удалить клиента <b>{client.name}</b>? Это
          действие нельзя отменить.
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
