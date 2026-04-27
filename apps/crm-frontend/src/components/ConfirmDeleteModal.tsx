import { Modal, Text, Group, Button } from "@mantine/core";

interface ConfirmDeleteModalProps {
  opened: boolean;
  onClose: () => void;
  title?: string;
  itemName?: string;
  onDelete: () => void;
  isDeleting: boolean;
}

export function ConfirmDeleteModal({
  opened,
  onClose,
  title = "Удаление",
  itemName,
  onDelete,
  isDeleting,
}: ConfirmDeleteModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>{title}</Text>}
      centered
      zIndex={300}
    >
      <Text size="sm" mb="lg">
        Вы уверены, что хотите удалить <b>{itemName}</b>? Это действие нельзя
        отменить.
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={isDeleting}>
          Отмена
        </Button>
        <Button color="red" onClick={onDelete} loading={isDeleting}>
          Удалить навсегда
        </Button>
      </Group>
    </Modal>
  );
}
