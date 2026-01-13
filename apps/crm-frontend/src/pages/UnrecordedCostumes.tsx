import {
  Title,
  Table,
  Button,
  Text,
  Paper,
  Badge,
  Group,
  Alert,
  Stack,
  Box,
  Divider,
} from "@mantine/core";
import {
  IconCheck,
  IconInfoCircle,
  IconTag,
  IconPhone,
} from "@tabler/icons-react";
import { useState } from "react";
import { useMediaQuery } from "@mantine/hooks";

const initialData = [
  {
    orderId: 4287,
    inventoryCode: "С-1235",
    costumeName: "Принцесса Жасмин",
    visitCode: "1230",
    childName: "Амина",
    clientPhone: "+77051234567",
    startDateTime: "2025-12-17T14:30:00+05:00",
    endDateTime: "2025-12-18T18:00:00+05:00",
    rentPrice: 8500,
    prepaymentAmount: 3000,
    notes: "осторожно с бисером на рукавах + взять доп. пояс",
  },
  {
    orderId: 4289,
    inventoryCode: "С-1245",
    costumeName: "Полицейский маленький",
    visitCode: "1625",
    childName: "Али",
    clientPhone: "+77051234567",
    startDateTime: "2025-12-17T14:30:00+05:00",
    endDateTime: "2025-12-18T18:00:00+05:00",
    rentPrice: 6200,
    prepaymentAmount: 2000,
    notes: "",
  },
];

export function UnrecordedCostumesPage() {
  const [orders, setOrders] = useState(initialData);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const handleMarkAsWritten = (id: number) => {
    setOrders((current) => current.filter((o) => o.orderId !== id));
  };

  // Компонент для десктопной таблицы
  const DesktopTable = (
    <Paper withBorder radius="md" shadow="sm">
      <Table.ScrollContainer minWidth={1000}>
        <Table verticalSpacing="md" highlightOnHover>
          <Table.Thead bg="gray.0">
            <Table.Tr>
              <Table.Th>Инв. код</Table.Th>
              <Table.Th>Костюм</Table.Th>
              <Table.Th>Ребенок</Table.Th>
              <Table.Th>Даты</Table.Th>
              <Table.Th>Финансы</Table.Th>
              <Table.Th>Заметки</Table.Th>
              <Table.Th>Действие</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orders.map((order) => (
              <Table.Tr key={order.orderId}>
                <Table.Td>
                  <Badge variant="light" color="blue" size="lg" radius="sm">
                    {order.inventoryCode}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text fw={700} size="sm">
                    {order.costumeName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Код визита: {order.visitCode}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{order.childName}</Text>
                  <Text size="xs" c="dimmed">
                    {order.clientPhone}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    Выдача:{" "}
                    {new Date(order.startDateTime).toLocaleDateString("ru-RU")}
                  </Text>
                  <Text size="xs">
                    Возврат:{" "}
                    {new Date(order.endDateTime).toLocaleDateString("ru-RU")}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>
                      {order.rentPrice} ₸
                    </Text>
                    <Text size="xs" c="green">
                      Внесено: {order.prepaymentAmount} ₸
                    </Text>
                  </Stack>
                </Table.Td>
                <Table.Td style={{ maxWidth: 200 }}>
                  {order.notes ? (
                    <Group gap={4} wrap="nowrap" align="flex-start">
                      <IconInfoCircle
                        size={14}
                        style={{ marginTop: 4, flexShrink: 0 }}
                      />
                      <Text size="xs" fs="italic">
                        {order.notes}
                      </Text>
                    </Group>
                  ) : (
                    <Text size="xs" c="gray.4">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Button
                    variant="light"
                    color="green"
                    size="xs"
                    leftSection={<IconCheck size={14} />}
                    onClick={() => handleMarkAsWritten(order.orderId)}
                  >
                    Бирка написана
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );

  // Компонент для мобильных карточек
  const MobileCards = (
    <Stack gap="md">
      {orders.map((order) => (
        <Paper key={order.orderId} withBorder p="md" radius="md" shadow="sm">
          <Stack gap="xs">
            <Group justify="space-between">
              <Badge variant="filled" color="blue" size="lg">
                {order.inventoryCode}
              </Badge>
              <Text size="xs" c="dimmed">
                Код: {order.visitCode}
              </Text>
            </Group>
            <Box>
              <Text fw={700} size="lg">
                {order.costumeName}
              </Text>
              <Text size="sm" fw={500}>
                {order.childName}
              </Text>
            </Box>
            <Group gap="xs">
              <IconPhone size={14} color="gray" />
              <Text size="xs" c="dimmed">
                {order.clientPhone}
              </Text>
            </Group>
            <Divider variant="dashed" />
            <Group justify="space-between">
              <Box>
                <Text size="xs" c="dimmed">
                  Аренда / Внесено
                </Text>
                <Text size="sm" fw={600}>
                  {order.rentPrice} ₸ /{" "}
                  <Text span c="green">
                    {order.prepaymentAmount} ₸
                  </Text>
                </Text>
              </Box>
              <Box style={{ textAlign: "right" }}>
                <Text size="xs" c="dimmed">
                  Выдача
                </Text>
                <Text size="sm" fw={600}>
                  {new Date(order.startDateTime).toLocaleDateString("ru-RU")}
                </Text>
              </Box>
            </Group>
            {order.notes && (
              <Box bg="orange.0" p="xs" style={{ borderRadius: "4px" }}>
                <Group gap={4} align="flex-start" wrap="nowrap">
                  <IconInfoCircle
                    size={14}
                    color="orange"
                    style={{ marginTop: 2 }}
                  />
                  <Text size="xs" c="orange.9">
                    {order.notes}
                  </Text>
                </Group>
              </Box>
            )}
            <Button
              fullWidth
              variant="light"
              color="green"
              mt="sm"
              leftSection={<IconCheck size={18} />}
              onClick={() => handleMarkAsWritten(order.orderId)}
              size="md"
            >
              Бирка написана
            </Button>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );

  return (
    <Stack gap="lg">
      {/* Заголовок общий для всех видов */}
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={isMobile ? 3 : 2}>Незаписанные костюмы</Title>
          <Text c="dimmed" size="sm">
            Подготовьте физические бирки для этих заказов
          </Text>
        </Box>
        {orders.length > 0 && (
          <Badge
            size="xl"
            variant="filled"
            color="orange"
            leftSection={<IconTag size={14} />}
          >
            Осталось: {orders.length}
          </Badge>
        )}
      </Group>

      {/* Основной контент */}
      {orders.length > 0 ? (
        isMobile ? (
          MobileCards
        ) : (
          DesktopTable
        )
      ) : (
        <Paper withBorder p={50} radius="md">
          <Stack align="center" gap="sm">
            <IconCheck size={48} color="var(--mantine-color-green-6)" />
            <Text fw={700} size="xl">
              Все бирки готовы!
            </Text>
            <Text c="dimmed">Незаписанных костюмов в системе нет.</Text>
          </Stack>
        </Paper>
      )}

      {/* Инструкция видна только если есть работа */}
      {orders.length > 0 && (
        <Alert
          variant="light"
          color="blue"
          title="Инструкция"
          icon={<IconInfoCircle />}
        >
          Напишите физическую бирку, прикрепите её к костюму и нажмите кнопку.
          Строка исчезнет из списка автоматически.
        </Alert>
      )}
    </Stack>
  );
}
