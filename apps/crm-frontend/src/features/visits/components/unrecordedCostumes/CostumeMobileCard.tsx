import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { useMarkCostumeAsWritten } from "../../hooks/useVisits";
import type { CostumeDesktopAndMobileProps } from "../../types/visitTypes";
import { IconCheck, IconInfoCircle, IconPhone } from "@tabler/icons-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  formatPhoneNumberForCostumes,
  formatStayDates,
} from "src/utills/formatters";

export function CostumeMobileCard({ items }: CostumeDesktopAndMobileProps) {
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
          }, 300);
        }
      },
    });
  };

  return (
    <Stack gap="md">
      <AnimatePresence>
        {items
          .filter((order) => order.orderId !== exitingId)
          .map((order) => (
            <motion.div
              key={order.orderId}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0, height: "auto" }}
              exit={{
                opacity: 0,
                scale: 0.9,
                x: -100,
                height: 0,
                transition: { duration: 0.3 },
              }}
              style={{ overflow: "hidden" }}
            >
              <Paper withBorder p="md" radius="md" shadow="sm">
                <Stack gap="xs">
                  <Group
                    justify="space-between"
                    align="flex-start"
                    wrap="nowrap"
                  >
                    <Text
                      fw={700}
                      size="lg"
                      style={{
                        lineHeight: 1.2,
                        flex: 1,
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                      }}
                    >
                      {order.costumeName}
                    </Text>

                    <Badge
                      variant="filled"
                      color="blue"
                      size="lg"
                      radius="sm"
                      style={{
                        flexShrink: 0,
                        marginLeft: "10px",
                      }}
                    >
                      {order.inventoryCode}
                    </Badge>
                  </Group>

                  <Box mb="xs">
                    <Text
                      size="sm"
                      c="dimmed"
                      fw={500}
                      tt="uppercase"
                      lts="0.5px"
                    >
                      Срок проката
                    </Text>
                    <Text size="md" fw={700} c="blue.9">
                      {formatStayDates(order.startDateTime, order.endDateTime)}
                    </Text>
                  </Box>

                  <Box>
                    <Text size="lg" fw={500}>
                      {order.childName}
                    </Text>
                    <Group>
                      <Text size="lg" c="black">
                        Код визита:
                      </Text>
                      <Badge color="blue" variant="filled" size="lg">
                        {order.visitCode}
                      </Badge>
                    </Group>
                  </Box>

                  <Group gap="xs">
                    <IconPhone size={14} color="gray" />
                    <Text fw={700} size="md" c="dimmed">
                      {formatPhoneNumberForCostumes(order.clientPhone)}
                    </Text>
                  </Group>

                  <Divider variant="dashed" />

                  <Box>
                    <Text size="lg" c="dimmed">
                      Аренда / Внесено
                    </Text>
                    <Text size="lg" fw={600}>
                      {order.rentPrice} ₸ /{" "}
                      <Text span c="green">
                        {order.prepaymentAmount} ₸
                      </Text>
                    </Text>
                  </Box>

                  {order.notes && (
                    <Box bg="orange.0" p="md" style={{ borderRadius: "4px" }}>
                      <Group gap={4} align="flex-start" wrap="nowrap">
                        <IconInfoCircle
                          size={20}
                          color="orange"
                          style={{ marginTop: 2 }}
                        />
                        <Text size="md" c="orange.9">
                          {order.notes}
                        </Text>
                      </Group>
                    </Box>
                  )}
                  <Text size="md" c="red">
                    Не забыть записать код костюма и код визита!
                  </Text>

                  <Button
                    fullWidth
                    variant="light"
                    color="green"
                    mt="sm"
                    leftSection={<IconCheck size={18} />}
                    loading={isPending && exitingId !== order.orderId}
                    onClick={() => handleMark(order.orderId)}
                    size="md"
                  >
                    Бирка написана
                  </Button>
                </Stack>
              </Paper>
            </motion.div>
          ))}
      </AnimatePresence>
    </Stack>
  );
}
