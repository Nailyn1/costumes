import { UnstyledButton, Group, ThemeIcon, Box, Text } from "@mantine/core";
import { IconShirt, IconChevronRight } from "@tabler/icons-react";

interface CostumeResultCardProps {
  name: string;
  inventoryCode: string;
  onClick: () => void;
}

export function CostumeResultCard({
  name,
  inventoryCode,
  onClick,
}: CostumeResultCardProps) {
  return (
    <UnstyledButton
      onClick={onClick}
      p="md"
      style={{ border: "1px solid #eee", borderRadius: "8px", width: "100%" }}
    >
      <Group justify="space-between" wrap="nowrap" align="center">
        <Group
          gap="sm"
          wrap="nowrap"
          align="flex-start"
          style={{ flex: 1, minWidth: 0 }}
        >
          <ThemeIcon
            variant="light"
            color="blue"
            size="lg"
            style={{ flexShrink: 0 }}
          >
            <IconShirt size={20} />
          </ThemeIcon>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} size="lg">
              {name}
            </Text>
            <Text size="lg" c="dimmed">
              Код: {inventoryCode}
            </Text>
          </Box>
        </Group>
        <IconChevronRight
          size={18}
          color="var(--mantine-color-gray-5)"
          style={{ flexShrink: 0 }}
        />
      </Group>
    </UnstyledButton>
  );
}
