import { type ReactNode } from "react";
import { Group, Box, Title, Text, Button, Modal } from "@mantine/core";
import { useMediaQuery, useDisclosure } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";

interface AddButtonProps {
  title: string;
  description?: string;
  buttonText?: string;
  modalTitle: string;
  renderCreateForm: (close: () => void) => ReactNode;
}

export function AddButton({
  title,
  description,
  buttonText = "Добавить",
  modalTitle,
  renderCreateForm,
}: AddButtonProps) {
  const isMobile = useMediaQuery("(max-width: 768px)") ?? false;
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={isMobile ? 3 : 2}>{title}</Title>
          {description && (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          )}
        </Box>
        <Button
          leftSection={<IconPlus size={18} />}
          onClick={open}
          size={isMobile ? "sm" : "md"}
        >
          {buttonText}
        </Button>
      </Group>

      <Modal
        opened={opened}
        onClose={close}
        title={modalTitle}
        radius="md"
        centered
      >
        {renderCreateForm(close)}
      </Modal>
    </>
  );
}
