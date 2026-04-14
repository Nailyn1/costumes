import {
  Title,
  Text,
  Paper,
  Stack,
  Box,
  TextInput,
  Loader,
  Center,
  Group,
  Button,
  Modal,
} from "@mantine/core";
import {
  useDebouncedValue,
  useDisclosure,
  useMediaQuery,
} from "@mantine/hooks";
import { IconSearch, IconPlus } from "@tabler/icons-react";
import React, { useState } from "react";
import { InView } from "react-intersection-observer";

import { CostumeAvailabilityModal } from "src/features/costumes/components/CostumeAvailabilityModal";
import { CostumeResultCard } from "src/features/costumes/components/CostumeResultCard";
import { CostumeCreateForm } from "src/features/costumes/components/costumeCreate";
import {
  useCostumeList,
  useSearchCostume,
} from "src/features/costumes/hooks/useCostumes";

export function CostumesPage() {
  const isMobile = useMediaQuery("(max-width: 768px)") ?? false;

  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 400);

  const [detailsOpened, { open: openDetails, close: closeDetails }] =
    useDisclosure(false);
  const [selectedCostumeId, setSelectedCostumeId] = useState<number | null>(
    null,
  );

  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);

  const { data: searchResults, isFetching: isSearchFetching } =
    useSearchCostume(debouncedQuery);
  const {
    data: allCostumes,
    isLoading: isAllLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCostumeList();

  const handleSelectCostume = (id: number) => {
    setSelectedCostumeId(id);
    openDetails();
  };

  const handleCostumeCreated = () => {
    closeCreate();
    setQuery("");
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={isMobile ? 3 : 2}>Костюмы</Title>
          <Text size="sm" c="dimmed">
            Управление каталогом и поиск
          </Text>
        </Box>
        <Button
          leftSection={<IconPlus size={18} />}
          onClick={openCreate}
          size={isMobile ? "sm" : "md"}
        >
          Добавить
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md" shadow="sm">
        <TextInput
          placeholder="Начните вводить название костюма или код..."
          size="md"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={18} />}
          rightSection={isSearchFetching ? <Loader size="xs" /> : null}
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

            {!isSearchFetching && searchResults?.length === 0 && (
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
          <>
            {isAllLoading ? (
              <Center mt="xl">
                <Loader type="dots" />
              </Center>
            ) : (
              <>
                {allCostumes?.pages.map((page, i) => (
                  <React.Fragment key={i}>
                    {page.items.map((item) => (
                      <CostumeResultCard
                        key={item.costumeId}
                        name={item.name}
                        inventoryCode={item.inventoryCode}
                        onClick={() => handleSelectCostume(item.costumeId)}
                      />
                    ))}
                  </React.Fragment>
                ))}

                <InView
                  onChange={(inView) => {
                    if (inView && hasNextPage && !isFetchingNextPage) {
                      fetchNextPage();
                    }
                  }}
                >
                  <Box h={20} />
                </InView>

                {isFetchingNextPage && (
                  <Center p="sm">
                    <Loader size="sm" type="dots" />
                  </Center>
                )}
              </>
            )}
          </>
        )}
      </Stack>

      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title="Новый костюм"
        radius="md"
      >
        <CostumeCreateForm
          onCreated={handleCostumeCreated}
          buttonText="Создать"
        />
      </Modal>

      {selectedCostumeId && (
        <CostumeAvailabilityModal
          opened={detailsOpened}
          onClose={closeDetails}
          costumeId={selectedCostumeId}
        />
      )}
    </Stack>
  );
}
