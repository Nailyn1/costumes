import {
  Title,
  Text,
  Paper,
  Badge,
  Group,
  Stack,
  Box,
  TextInput,
  Modal,
  Checkbox,
  Textarea,
  Divider,
  Button,
  ActionIcon,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  IconSearch,
  IconRotateClockwise2,
  IconCheck,
  IconMoodDollar,
  IconArrowRight,
} from "@tabler/icons-react";
import { useState } from "react";

// Имитация данных
const initialVisits = [
  {
    visitCode: "1648",
    clientName: "Александр Громов",
    clientPhone: "+7 707 123 45 67",
    children: ["Алия", "Дамир"],
    costumes: ["Эльза", "Бэтмен"],
    status: "issued",
    issueDate: "16.12.2025",
    returnDate: "17.12.2025",
    depositReturned: false,
    orders: [
      {
        id: 101,
        child: "Алия",
        costume: "Эльза",
        code: "C-0128",
        returned: false,
      },
      {
        id: 102,
        child: "Дамир",
        costume: "Бэтмен",
        code: "C-0542",
        returned: false,
      },
    ],
  },
  {
    visitCode: "1230",
    clientName: "Елена Успанова",
    clientPhone: "+7 701 555 44 33",
    children: ["Амина"],
    costumes: ["Жасмин"],
    status: "completed",
    depositReturned: false, // Особый случай: залог не забран
    issueDate: "14.12.2025",
    returnDate: "15.12.2025",
    orders: [
      {
        id: 103,
        child: "Амина",
        costume: "Жасмин",
        code: "С-1235",
        returned: true,
      },
    ],
  },
];

export function ReturnPage() {
  const [visits, setVisits] = useState(initialVisits);
  const [selectedVisit, setSelectedVisit] = useState<
    (typeof initialVisits)[0] | null
  >(null);
  const [returnOpened, { open: openReturn, close: closeReturn }] =
    useDisclosure(false);
  const [depositOpened, { open: openDeposit, close: closeDeposit }] =
    useDisclosure(false);

  const isMobile = useMediaQuery("(max-width: 768px)");

  // Состояния для формы возврата
  const [returnedItems, setReturnedItems] = useState<number[]>([]);
  const [isDepositTaken, setIsDepositTaken] = useState(false);

  const handleOpenVisit = (visit: (typeof initialVisits)[0]) => {
    setSelectedVisit(visit);
    if (visit.status === "issued") {
      setReturnedItems([]);
      setIsDepositTaken(false);
      openReturn();
    } else {
      openDeposit();
    }
  };

  const toggleItem = (id: number) => {
    setReturnedItems((current) =>
      current.includes(id) ? current.filter((i) => i !== id) : [...current, id]
    );
  };

  const handleCompleteReturn = () => {
    setVisits((prev) =>
      prev.map((v) =>
        v.visitCode === selectedVisit?.visitCode
          ? { ...v, status: "completed", depositReturned: isDepositTaken }
          : v
      )
    );
    closeReturn();
  };

  const handleConfirmDeposit = () => {
    setVisits((prev) =>
      prev.map((v) =>
        v.visitCode === selectedVisit?.visitCode
          ? { ...v, depositReturned: true }
          : v
      )
    );
    closeDeposit();
  };

  const allItemsSelected =
    selectedVisit?.orders.length === returnedItems.length;

  return (
    <Stack gap="lg">
      <Title order={2}>Возврат костюмов</Title>

      <TextInput
        placeholder="Поиск по коду, имени, костюму..."
        size="md"
        leftSection={<IconSearch size={18} />}
      />

      <Stack gap="sm">
        <Text fw={700} size="sm" c="dimmed" tt="uppercase">
          К возврату / Забытые залоги
        </Text>

        {visits.map((visit) => (
          <Paper
            key={visit.visitCode}
            withBorder
            p="md"
            radius="md"
            onClick={() => handleOpenVisit(visit)}
            style={{
              borderColor:
                visit.status === "completed"
                  ? "var(--mantine-color-orange-4)"
                  : undefined,
              cursor: "pointer",
            }}
          >
            <Stack gap="xs">
              <Group justify="space-between">
                <Badge
                  variant="filled"
                  color={visit.status === "completed" ? "orange" : "blue"}
                >
                  #{visit.visitCode}
                </Badge>
                {visit.status === "completed" && (
                  <Badge color="orange" variant="dot">
                    Залог у нас!
                  </Badge>
                )}
              </Group>

              <Box>
                <Text fw={700} size="md">
                  {visit.clientName}
                </Text>
                <Text size="xs" c="dimmed">
                  Дети: {visit.children.join(", ")}
                </Text>
              </Box>

              <Group gap="xs">
                <IconRotateClockwise2 size={14} color="gray" />
                <Text size="xs" fw={500} c="dimmed">
                  Костюмы: {visit.costumes.join(", ")}
                </Text>
              </Group>

              <Divider variant="dashed" />

              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Срок: {visit.returnDate}
                </Text>
                <ActionIcon variant="subtle">
                  <IconArrowRight size={18} />
                </ActionIcon>
              </Group>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {/* MODAL 1: Основной возврат */}
      <Modal
        opened={returnOpened}
        onClose={closeReturn}
        title={<Text fw={700}>Возврат визита #{selectedVisit?.visitCode}</Text>}
        fullScreen={isMobile}
      >
        {selectedVisit && (
          <Stack gap="md">
            <Box>
              <Text size="sm" fw={600}>
                {selectedVisit.clientName}
              </Text>
              <Text size="xs" c="dimmed">
                {selectedVisit.clientPhone}
              </Text>
            </Box>

            <Divider
              label="Отметьте возвращенные вещи"
              labelPosition="center"
            />

            <Stack gap="xs">
              {selectedVisit.orders.map((order) => (
                <Paper
                  key={order.id}
                  withBorder
                  p="sm"
                  radius="md"
                  onClick={() => toggleItem(order.id)}
                  style={{
                    cursor: "pointer",
                    backgroundColor: returnedItems.includes(order.id)
                      ? "var(--mantine-color-green-0)"
                      : "transparent",
                    borderColor: returnedItems.includes(order.id)
                      ? "var(--mantine-color-green-4)"
                      : undefined,
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Box>
                      <Text size="sm" fw={700}>
                        {order.costume}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {order.child} | {order.code}
                      </Text>
                    </Box>
                    <Checkbox
                      checked={returnedItems.includes(order.id)}
                      onChange={() => {}} // Управляется кликом по Paper
                      color="green"
                      size="md"
                    />
                  </Group>
                </Paper>
              ))}
            </Stack>

            <Box bg="gray.0" p="sm" style={{ borderRadius: "8px" }}>
              <Checkbox
                label="Залог возвращён клиенту"
                checked={isDepositTaken}
                onChange={(e) => setIsDepositTaken(e.currentTarget.checked)}
              />
            </Box>

            <Textarea
              label="Комментарий при возврате"
              placeholder="..."
              minRows={2}
            />

            <Button
              fullWidth
              size="lg"
              color="green"
              disabled={!allItemsSelected}
              leftSection={<IconCheck size={20} />}
              onClick={handleCompleteReturn}
            >
              Костюмы возвращены
            </Button>
            {!allItemsSelected && (
              <Text size="xs" c="dimmed" ta="center">
                Кнопка станет активной, когда вы отметите все костюмы
              </Text>
            )}
          </Stack>
        )}
      </Modal>

      {/* MODAL 2: Только залог */}
      <Modal
        opened={depositOpened}
        onClose={closeDeposit}
        title="Возврат залога"
        centered
      >
        <Stack align="center" gap="md" py="md">
          <IconMoodDollar size={48} color="var(--mantine-color-orange-6)" />
          <Text ta="center" fw={500}>
            Костюмы по визиту <b>#{selectedVisit?.visitCode}</b> уже были
            возвращены, но залог остался в Пупавке.
          </Text>
          <Title order={4}>Клиент забрал залог?</Title>
          <Group grow w="100%">
            <Button variant="light" color="gray" onClick={closeDeposit}>
              Нет
            </Button>
            <Button color="green" onClick={handleConfirmDeposit}>
              Да, забрали
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
