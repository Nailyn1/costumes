import { Title, Text, Paper, Badge, Group, Stack, Box } from "@mantine/core";
import { IconCheck, IconTag } from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import { useNotWrittenCostumes } from "src/features/visits/hooks/useVisits";
import { CostumeMobileCard } from "src/features/visits/components/unrecordedCostumes/CostumeMobileCard";
import { CostumeDesktopTable } from "src/features/visits/components/unrecordedCostumes/CostumeDesktopTable";
import { motion, AnimatePresence } from "framer-motion";

export function UnrecordedCostumesPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data: orders, isLoading, isError } = useNotWrittenCostumes();

  if (isLoading) {
    return <Text>Загрузка данных...</Text>;
  }

  if (isError || !orders) {
    return <Text c="red">Произошла ошибка при загрузке данных</Text>;
  }

  const itemsCount = orders.length || 0;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={isMobile ? 3 : 2}>Незаписанные костюмы</Title>
          <Text c="dimmed" size="sm">
            Подготовьте физические бирки для этих заказов
          </Text>
        </Box>

        <AnimatePresence>
          {itemsCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <Badge
                size="xl"
                variant="filled"
                color="orange"
                leftSection={<IconTag size={14} />}
              >
                Осталось: {itemsCount}
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </Group>

      <AnimatePresence mode="wait">
        {itemsCount > 0 ? (
          <motion.div
            key="list-content"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {isMobile ? (
              <CostumeMobileCard items={orders} />
            ) : (
              <CostumeDesktopTable items={orders} />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Paper withBorder p={100} radius="md" bg="white">
              <Stack align="center" gap="md">
                <Box
                  style={{
                    backgroundColor: "var(--mantine-color-green-0)",
                    padding: 20,
                    borderRadius: "50%",
                  }}
                >
                  <IconCheck size={48} color="var(--mantine-color-green-6)" />
                </Box>
                <Stack align="center" gap={4}>
                  <Text fw={700} size="xl">
                    Все бирки готовы!
                  </Text>
                  <Text c="dimmed" ta="center">
                    На данный момент незаписанных костюмов в системе нет.
                    <br /> Отличная работа!
                  </Text>
                </Stack>
              </Stack>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </Stack>
  );
}
