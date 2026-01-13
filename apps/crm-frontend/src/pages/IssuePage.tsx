import {
  Title,
  Table,
  Button,
  Text,
  Paper,
  Badge,
  Group,
  Stack,
  Box,
  TextInput,
  Modal,
  NumberInput,
  SegmentedControl,
  Textarea,
  Divider,
  ActionIcon,
  SimpleGrid,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  IconSearch,
  IconCheck,
  IconArrowRight,
  IconUser,
  IconShirt,
} from "@tabler/icons-react";
import { useState } from "react";

const todaysVisits = [
  {
    visitCode: "1648",
    clientName: "Александр Громов",
    clientPhone: "+7 707 123 45 67",
    children: ["Алия", "Марат"],
    costumes: ["Эльза P32 белая", "Снеговик блестки p104"],
    totalRent: 15000,
    prepayment: 5000,
    issueTime: "18:30 - 19:30",
    returnDate: "18.12.2025",
    orders: [
      {
        id: 1,
        child: "Алия",
        costume: "Эльза P32 белая",
        code: "C-0128",
        rent: 8000,
        prepay: 3000,
      },
      {
        id: 2,
        child: "Марат",
        costume: "Снеговик блестки p104",
        code: "C-0542",
        rent: 7000,
        prepay: 2000,
      },
    ],
  },
  {
    visitCode: "1230",
    clientName: "Елена Успанова",
    clientPhone: "+7 701 555 44 33",
    children: ["Амина"],
    costumes: ["Жасмин большая"],
    totalRent: 8500,
    prepayment: 3000,
    issueTime: "10:00 - 19:00",
    returnDate: "19.12.2025",
    orders: [
      {
        id: 3,
        child: "Амина",
        costume: "Жасмин",
        code: "С-1235",
        rent: 8500,
        prepay: 3000,
      },
    ],
  },
];

export function IssuePage() {
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedVisit, setSelectedVisit] = useState<
    (typeof todaysVisits)[0] | null
  >(null);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [extraPayment, setExtraPayment] = useState<number>(0);
  const [depositType, setDepositType] = useState<string>("cash");

  const handleOpenVisit = (visit: (typeof todaysVisits)[0]) => {
    setSelectedVisit(visit);
    setExtraPayment(visit.totalRent - visit.prepayment);
    open();
  };

  const handleIssue = () => {
    console.log("Выдача визита:", selectedVisit?.visitCode);
    close();
  };

  // --- ДЕСКТОПНАЯ ТАБЛИЦА ---
  const DesktopTable = (
    <Table verticalSpacing="md" highlightOnHover>
      <Table.Thead bg="gray.0">
        <Table.Tr>
          <Table.Th>Код</Table.Th>
          <Table.Th>Клиент</Table.Th>
          <Table.Th>Дети</Table.Th>
          <Table.Th>Костюмы</Table.Th>
          <Table.Th></Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {todaysVisits.map((visit) => (
          <Table.Tr
            key={visit.visitCode}
            onClick={() => handleOpenVisit(visit)}
            style={{ cursor: "pointer" }}
          >
            <Table.Td>
              <Badge size="lg" radius="sm">
                {visit.visitCode}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>
                {visit.clientName}
              </Text>
              <Text size="xs" c="dimmed">
                {visit.clientPhone}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{visit.children.join(", ")}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fs="italic">
                {visit.costumes.join(", ")}
              </Text>
            </Table.Td>
            <Table.Td>
              <ActionIcon variant="light" color="blue">
                <IconArrowRight size={18} />
              </ActionIcon>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );

  // --- МОБИЛЬНЫЕ КАРТОЧКИ ---
  const MobileCards = (
    <Stack gap="sm">
      {todaysVisits.map((visit) => (
        <Paper
          key={visit.visitCode}
          withBorder
          p="md"
          radius="md"
          onClick={() => handleOpenVisit(visit)}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Badge color="blue" variant="light">
                #{visit.visitCode}
              </Badge>
              <Text size="xs" c="dimmed">
                {visit.issueTime}
              </Text>
            </Group>

            <Box>
              <Text fw={700} size="md">
                {visit.clientName}
              </Text>
              <Text size="xs" c="dimmed">
                {visit.clientPhone}
              </Text>
            </Box>

            <Group gap="xl" mt="xs">
              <Box>
                <Group gap={4} mb={4}>
                  <IconUser size={14} color="gray" />
                  <Text size="xs" fw={500}>
                    Дети
                  </Text>
                </Group>
                <Text size="sm">{visit.children.join(", ")}</Text>
              </Box>
              <Box>
                <Group gap={4} mb={4}>
                  <IconShirt size={14} color="gray" />
                  <Text size="xs" fw={500}>
                    Костюмы
                  </Text>
                </Group>
                <Text size="sm" fs="italic">
                  {visit.costumes.join(", ")}
                </Text>
              </Box>
            </Group>

            <Divider variant="dashed" />

            <Group justify="space-between">
              <Text size="sm" fw={600} c="blue">
                К доплате: {visit.totalRent - visit.prepayment} ₸
              </Text>
              <Button
                size="xs"
                variant="light"
                rightSection={<IconArrowRight size={14} />}
              >
                Оформить
              </Button>
            </Group>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );

  return (
    <Stack gap="lg">
      <Title order={isMobile ? 3 : 2}>Выдача костюмов</Title>

      <Paper withBorder p="md" radius="md" shadow="xs">
        <TextInput
          placeholder="Поиск (код, имя, костюм, телефон)..."
          size="md"
          leftSection={<IconSearch size={18} />}
        />
      </Paper>

      <Box>
        <Text fw={700} mb="xs" ml={2}>
          Сегодня к выдаче
        </Text>
        {isMobile ? (
          MobileCards
        ) : (
          <Paper withBorder radius="md" overflow-hidden>
            <Table.ScrollContainer minWidth={800}>
              {DesktopTable}
            </Table.ScrollContainer>
          </Paper>
        )}
      </Box>

      {/* Модальное окно (остается без изменений, так как оно уже адаптировано под fullScreen) */}
      <Modal
        opened={opened}
        onClose={close}
        title={<Text fw={700}>Выдача #{selectedVisit?.visitCode}</Text>}
        size="lg"
        fullScreen={isMobile}
      >
        {selectedVisit && (
          <Stack gap="md">
            <Group grow align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Клиент
                </Text>
                <Text fw={600}>{selectedVisit.clientName}</Text>
                <Text size="sm">{selectedVisit.clientPhone}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Возврат
                </Text>
                <Text fw={600}>{selectedVisit.returnDate}</Text>
                <Text size="sm">до 19:00</Text>
              </Box>
            </Group>

            <Divider label="Заказы" labelPosition="center" />

            <Stack gap="xs">
              {selectedVisit.orders.map((order) => (
                <Paper key={order.id} withBorder p="xs" radius="sm" bg="gray.0">
                  <Group justify="space-between">
                    <Box>
                      <Text size="sm" fw={700}>
                        {order.child} — {order.costume}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Код: {order.code}
                      </Text>
                    </Box>
                    <Box style={{ textAlign: "right" }}>
                      <Text size="sm" fw={600}>
                        {order.rent} ₸
                      </Text>
                      <Text size="xs" c="green">
                        Предоплата: {order.prepay} ₸
                      </Text>
                    </Box>
                  </Group>
                </Paper>
              ))}
            </Stack>

            <Box p="md" bg="blue.0" style={{ borderRadius: "8px" }}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={700}>К доплате:</Text>
                  <Text fw={700} size="xl" c="blue.9">
                    {selectedVisit.totalRent - selectedVisit.prepayment} ₸
                  </Text>
                </Group>
                <SimpleGrid cols={isMobile ? 1 : 2}>
                  <NumberInput
                    label="Сумма доплаты"
                    value={extraPayment}
                    onChange={(val) => setExtraPayment(Number(val))}
                    suffix=" ₸"
                  />
                  <Box>
                    <Text size="sm" fw={500} mb={3}>
                      Залог
                    </Text>
                    <SegmentedControl
                      fullWidth
                      data={[
                        { label: "Нал", value: "cash" },
                        { label: "Док", value: "document" },
                        { label: "Нет", value: "none" },
                      ]}
                      value={depositType}
                      onChange={setDepositType}
                    />
                  </Box>
                </SimpleGrid>
                {depositType === "cash" && (
                  <NumberInput label="Сумма залога" suffix=" ₸" />
                )}
              </Stack>
            </Box>

            <Textarea
              label="Комментарий"
              placeholder="Особенности..."
              minRows={2}
            />

            <Button
              size="lg"
              fullWidth
              color="green"
              leftSection={<IconCheck size={20} />}
              onClick={handleIssue}
            >
              Выдать костюмы
            </Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
