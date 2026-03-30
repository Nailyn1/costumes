import { useMarkCostumeAsWritten } from "../../hooks/useVisits";
import { Badge, Button, Group, Paper, Stack, Table, Text } from "@mantine/core";
import type { CostumeDesktopAndMobileProps } from "../../types/visitTypes";
import { IconCheck, IconInfoCircle, IconPhone } from "@tabler/icons-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { formatPhoneNumber, formatStayDates } from "src/utills/formatters";

const MotionTr = motion(Table.Tr);

export function CostumeDesktopTable({ items }: CostumeDesktopAndMobileProps) {
  const [exitingId, setExitingId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMarkCostumeAsWritten();

  const handleMark = (id: number) => {
    mutate(id, {
      onSuccess: () => {
        if (items.length === 1) {
          queryClient.invalidateQueries({
            queryKey: ["visits", "not-written"],
          });
        } else {
          setExitingId(id);
          setTimeout(async () => {
            await queryClient.invalidateQueries({
              queryKey: ["visits", "not-written"],
            });
            setExitingId(null);
          }, 400);
        }
      },
    });
  };

  return (
    <Paper withBorder radius="md" shadow="sm">
      <Table.ScrollContainer minWidth={1000}>
        <Table
          layout="fixed"
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
              <Table.Th>Костюм</Table.Th>
              <Table.Th>Срок проката</Table.Th>
              <Table.Th>Заказ</Table.Th>
              <Table.Th>Аренда / Предоплата</Table.Th>
              <Table.Th>Заметки</Table.Th>
              <Table.Th w={180}>Действие</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <AnimatePresence>
              {items
                .filter((order) => order.orderId !== exitingId)
                .map((order) => (
                  <MotionTr
                    key={order.orderId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{
                      opacity: 0,
                      backgroundColor: "var(--mantine-color-red-0)",
                      transition: { duration: 0.4 },
                    }}
                  >
                    <Table.Td>
                      <Stack gap={4}>
                        <Text fw={700} size="lg">
                          {order.costumeName}
                        </Text>
                        <Badge
                          variant="light"
                          color="blue"
                          size="lg"
                          radius="sm"
                        >
                          {order.inventoryCode}
                        </Badge>
                      </Stack>
                    </Table.Td>

                    <Table.Td>
                      <Text size="lg" fw={500}>
                        {formatStayDates(
                          order.startDateTime,
                          order.endDateTime,
                        )}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="lg" fw={500}>
                          {order.childName}
                        </Text>
                        <Group gap={6} wrap="nowrap">
                          <IconPhone size={16} color="gray" />
                          <Text size="lg" fw={700} c="blue.8">
                            {formatPhoneNumber(order.clientPhone)}
                          </Text>
                        </Group>
                        <Text size="lg" c="dimmed">
                          Код визита: {order.visitCode}
                        </Text>
                      </Stack>
                    </Table.Td>

                    <Table.Td>
                      <Text size="lg" fw={700}>
                        {order.rentPrice} /{" "}
                        <Text span c="green.7" fw={700}>
                          {order.prepaymentAmount} ₸
                        </Text>
                      </Text>
                    </Table.Td>

                    <Table.Td style={{ maxWidth: 250 }}>
                      {order.notes ? (
                        <Group gap={6} wrap="nowrap" align="flex-start">
                          <IconInfoCircle
                            size={18}
                            color="orange"
                            style={{ marginTop: 4, flexShrink: 0 }}
                          />
                          <Text size="lg" fs="italic" c="gray.7">
                            {order.notes}
                          </Text>
                        </Group>
                      ) : (
                        <Text size="lg" c="gray.4">
                          —
                        </Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      <Button
                        variant="light"
                        color="green"
                        size="md"
                        leftSection={<IconCheck size={14} />}
                        loading={isPending && exitingId !== order.orderId}
                        onClick={() => handleMark(order.orderId)}
                      >
                        Бирка написана
                      </Button>
                    </Table.Td>
                  </MotionTr>
                ))}
            </AnimatePresence>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
