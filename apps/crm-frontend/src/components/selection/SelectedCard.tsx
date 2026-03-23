import { useState, type ReactNode } from "react";
import {
  Paper,
  Group,
  Text,
  Menu,
  ActionIcon,
  Modal,
  Button,
  Stack,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconArrowsExchange,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";

interface SelectedCardProps {
  title: string;
  description?: ReactNode;
  changeLabel?: string;
  deleteModalTitle?: string;
  onClear: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  renderUpdateForm: (close: () => void) => ReactNode;
}

export function SelectedCard({
  title,
  description,
  changeLabel = "Выбрать другого",
  deleteModalTitle = "Удаление",
  onClear,
  onDelete,
  isDeleting,
  renderUpdateForm,
}: SelectedCardProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const closeEdit = () => setIsEditing(false);

  return (
    <>
      <Paper
        withBorder
        p="sm"
        radius="md"
        bg={isEditing ? "transparent" : "blue.0"}
      >
        {isEditing ? (
          renderUpdateForm(closeEdit)
        ) : (
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={0} style={{ overflow: "hidden" }}>
              <Text fw={500} truncate>
                {title}
              </Text>
              {description && (
                <Text size="sm" c="dimmed">
                  {description}
                </Text>
              )}
            </Stack>

            <Menu position="bottom-end" shadow="sm">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size="1.2rem" />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconArrowsExchange size={16} />}
                  onClick={onClear}
                >
                  {changeLabel}
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

      <Modal
        opened={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={deleteModalTitle}
        centered
      >
        <Text size="sm" mb="lg">
          Вы уверены, что хотите удалить <b>{title}</b>? Это действие нельзя
          отменить.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setIsDeleteModalOpen(false)}>
            Отмена
          </Button>
          <Button color="red" onClick={onDelete} loading={isDeleting}>
            Удалить навсегда
          </Button>
        </Group>
      </Modal>
    </>
  );
}
