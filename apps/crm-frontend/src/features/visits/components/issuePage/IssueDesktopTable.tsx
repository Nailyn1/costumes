import { Table, Badge, Text, ActionIcon, Button, Group } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import type { IssueListProps } from "../../types/visitTypes";
import { formatPhoneNumber } from "src/utils/formatters";

export function IssueDesktopTable({ items, onOpenVisit }: IssueListProps) {
  return (
    <Table
      verticalSpacing="md"
      highlightOnHover
      styles={{
        th: {
          fontSize: "var(--mantine-font-size-lg)",
          color: "var(--mantine-color-gray-8)",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          paddingTop: "20px !important",
          paddingBottom: "20px !important",
        },
      }}
    >
      <Table.Thead bg="gray.1">
        <Table.Tr>
          <Table.Th w={120}>Код</Table.Th>
          <Table.Th>Клиент</Table.Th>
          <Table.Th>Дети</Table.Th>
          <Table.Th>Костюмы</Table.Th>
          <Table.Th w={160}></Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((visit) => (
          <Table.Tr
            key={visit.visitId}
            onClick={() => onOpenVisit(visit)}
            style={{ cursor: "pointer" }}
          >
            <Table.Td>
              <Badge size="lg" radius="sm">
                #{visit.visitCode}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="lg" fw={500}>
                {visit.clientName}
              </Text>
              <Text size="lg" c="dimmed">
                {formatPhoneNumber(visit.clientPhone)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="lg">{visit.childrenNames}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="lg" fs="italic">
                {visit.costumesNames}
              </Text>
            </Table.Td>
            <Table.Td>
              <Group gap="xs" wrap="nowrap">
                <Button component={Link} to={`/bookings/visits/${visit.visitId}`} variant="subtle" size="xs" onClick={(event) => event.stopPropagation()}>
                  Карточка
                </Button>
                <ActionIcon variant="light" color="blue" aria-label="Открыть выдачу">
                  <IconArrowRight size={18} />
                </ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
