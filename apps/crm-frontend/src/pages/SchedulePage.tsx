import {
  Title,
  Text,
  Paper,
  Stack,
  Box,
  TextInput,
  Loader,
  Center,
} from "@mantine/core";
import {
  useDebouncedValue,
  useDisclosure,
  useMediaQuery,
} from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { CostumeAvailabilityModal } from "src/features/costumes/components/CostumeAvailabilityModal";
import { CostumeResultCard } from "src/features/costumes/components/CostumeResultCard";
import { useSearchCostume } from "src/features/costumes/hooks/useCostumes";

export function SchedulePage() {
  const isMobile = useMediaQuery("(max-width: 768px)") ?? false;
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 400);

  const [opened, { open, close }] = useDisclosure(false);
  const [selectedCostumeId, setSelectedCostumeId] = useState<number | null>(
    null,
  );

  const { data: searchResults, isFetching } = useSearchCostume(debouncedQuery);

  const handleSelectCostume = (id: number) => {
    setSelectedCostumeId(id);
    open();
  };

  return (
    <Stack gap="lg">
      <Box>
        <Title order={isMobile ? 3 : 2}>Проверка занятости</Title>
        <Text size="sm" c="dimmed">
          Поиск свободных дат для костюма
        </Text>
      </Box>

      <Paper withBorder p="md" radius="md" shadow="sm">
        <TextInput
          placeholder="Начните вводить название костюма или код..."
          size="md"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={18} />}
          rightSection={isFetching ? <Loader size="xs" /> : null}
        />
      </Paper>

      <Stack gap="xs">
        {query.trim().length >= 2 ? (
          <>
            {searchResults?.map((item) => (
              <CostumeResultCard
                key={item.costumeId}
                name={item.name}
                inventoryCode={item.inventoryCode}
                onClick={() => handleSelectCostume(item.costumeId)}
              />
            ))}

            {!isFetching && searchResults?.length === 0 && (
              <Text size="sm" c="dimmed" ta="center" mt="xl">
                Костюмы не найдены
              </Text>
            )}
          </>
        ) : query.length > 0 ? (
          <Text size="xs" c="dimmed" ta="center">
            Введите минимум 2 символа для поиска...
          </Text>
        ) : (
          <Center mt="xl">
            <Text c="dimmed">
              Введите название костюма, чтобы проверить его доступность
            </Text>
          </Center>
        )}
      </Stack>

      {selectedCostumeId && (
        <CostumeAvailabilityModal
          opened={opened}
          onClose={close}
          costumeId={selectedCostumeId}
          isMobile={isMobile}
        />
      )}
    </Stack>
  );
}
