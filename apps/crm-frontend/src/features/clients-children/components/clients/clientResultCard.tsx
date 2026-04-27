import { UnstyledButton, Group, Box, Text, Badge } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { formatPhoneNumber } from "src/utills/formatters";

interface ClientResultCardProps {
  name: string;
  phone: string;
  isBlacklisted: boolean;
  onClick: () => void;
}

export function ClientResultCard({
  name,
  phone,
  isBlacklisted,
  onClick,
}: ClientResultCardProps) {
  return (
    <UnstyledButton
      onClick={onClick}
      p="md"
      style={{
        border: "1px solid var(--mantine-color-gray-3)",
        borderRadius: "8px",
        width: "100%",
      }}
    >
      <Group justify="space-between" wrap="nowrap" align="center">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" align="center">
            <Text fw={600} size="lg" truncate>
              {name}
            </Text>
            {isBlacklisted && (
              <Badge color="red" variant="light" size="sm">
                В ЧС
              </Badge>
            )}
          </Group>
          <Text size="md" c="dimmed">
            {formatPhoneNumber(phone)}
          </Text>
        </Box>
        <IconChevronRight
          size={18}
          color="var(--mantine-color-gray-5)"
          style={{ flexShrink: 0 }}
        />
      </Group>
    </UnstyledButton>
  );
}
