import { Box, Button, Center, Loader, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";
import { AddButton } from "src/components/AddButtonWithModal";
import { ClientCreateForm } from "src/features/clients-children/components/clients/clientCreate";
import { ClientDetailedModal } from "src/features/clients-children/components/clients/clientModal";
import { ClientResultCard } from "src/features/clients-children/components/clients/clientResultCard";
import { ClientSearchInput } from "src/features/clients-children/components/clients/clientSearchFieldForPage";
import { useClientsList } from "src/features/clients-children/hooks/useClients";

export function ClientsPage() {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [isModalOpen, { open: openModal, close: closeModal }] =
    useDisclosure(false);

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useClientsList();

  const handleSelectClient = (clientId: number) => {
    setSelectedClientId(clientId);
    openModal();
  };

  if (isError) {
    return <Text c="red">Ошибка при загрузке списка клиентов</Text>;
  }
  return (
    <Stack gap="lg">
      <AddButton
        title="Клиенты"
        description="Управление базой клиентов"
        modalTitle="Новый клиент"
        renderCreateForm={(close) => (
          <ClientCreateForm
            onCreated={() => {
              close();
            }}
          />
        )}
      />

      <ClientSearchInput onSelectClient={handleSelectClient} />

      <Box>
        {isLoading ? (
          <Center p="xl">
            <Loader />
          </Center>
        ) : (
          <Stack gap="sm">
            {data?.pages.map((page) =>
              page.items.map((client) => (
                <ClientResultCard
                  key={client.clientId}
                  name={client.name}
                  phone={client.phone}
                  isBlacklisted={client.isBlacklisted}
                  onClick={() => handleSelectClient(client.clientId)}
                />
              )),
            )}
          </Stack>
        )}
      </Box>

      {hasNextPage && (
        <Button
          variant="light"
          onClick={() => fetchNextPage()}
          loading={isFetchingNextPage}
          fullWidth
          mt="md"
        >
          Загрузить еще
        </Button>
      )}
      <ClientDetailedModal
        opened={isModalOpen}
        onClose={closeModal}
        clientId={selectedClientId}
      />
    </Stack>
  );
}
