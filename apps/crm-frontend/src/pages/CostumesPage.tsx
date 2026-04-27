import {
  Text,
  Paper,
  Stack,
  Box,
  TextInput,
  Loader,
  Center,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import React, { useState } from "react";
import { InView } from "react-intersection-observer";
import { AddButton } from "src/components/AddButtonWithModal";

import { CostumeAvailabilityModal } from "src/features/costumes/components/CostumeAvailabilityModal";
import { CostumeResultCard } from "src/features/costumes/components/CostumeResultCard";
import { CostumeCreateForm } from "src/features/costumes/components/costumeCreate";
import {
  useCostumeList,
  useSearchCostume,
} from "src/features/costumes/hooks/useCostumes";

export function CostumesPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 400);

  const [detailsOpened, { open: openDetails, close: closeDetails }] =
    useDisclosure(false);
  const [selectedCostumeId, setSelectedCostumeId] = useState<number | null>(
    null,
  );

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

  return (
    <Stack gap="lg">
      <AddButton
        title="Костюмы"
        description="Управление каталогом и поиск"
        modalTitle="Новый костюм"
        renderCreateForm={(close) => (
          <CostumeCreateForm
            onCreated={() => {
              close();
              setQuery("");
            }}
            buttonText="Создать"
          />
        )}
      />

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
