import { useState } from "react";
import {
  Combobox,
  TextInput,
  useCombobox,
  Loader,
  Text,
  Group,
  Box,
  Badge,
  ScrollAreaAutosize,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import {
  SEARCH_COMBOBOX_MAX_HEIGHT,
  SEARCH_COMBOBOX_Z_INDEX,
} from "src/components/searchComboboxSettings";
import { formatPhoneNumber } from "src/utils/formatters";
import { useSearchClients } from "../../hooks/useClients";

interface ClientSearchInputProps {
  onSelectClient: (clientId: number) => void;
  placeholder?: string;
}

export function ClientSearchInput({
  onSelectClient,
  placeholder = "Поиск клиента...",
}: ClientSearchInputProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchQuery, 400);

  const { data: searchResults, isLoading } = useSearchClients(debouncedQuery);

  const handleOptionSubmit = (val: string) => {
    onSelectClient(Number(val));
    setSearchQuery("");
    combobox.closeDropdown();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const isValidSearch = searchQuery.trim().length >= 2;

  const options = isValidSearch
    ? (searchResults || []).map((client) => (
        <Combobox.Option value={String(client.clientId)} key={client.clientId}>
          <Group wrap="nowrap" justify="space-between" align="center">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Group gap={6} align="center" wrap="wrap" style={{ rowGap: 0 }}>
                <Text size="md" fw={500}>
                  {client.name}
                </Text>
                <Text size="md" fw={500}>
                  {formatPhoneNumber(client.phone)}
                </Text>
              </Group>

              {client.children && client.children.length > 0 && (
                <Text size="sm" c="dimmed" truncate="end">
                  {client.children.map((child) => child.name).join(", ")}
                </Text>
              )}
            </Box>

            {client.isBlacklisted && (
              <Badge color="red" variant="light" size="sm">
                В ЧС
              </Badge>
            )}
          </Group>
        </Combobox.Option>
      ))
    : [];

  return (
    <Combobox
      onOptionSubmit={handleOptionSubmit}
      store={combobox}
      withinPortal={true}
      zIndex={SEARCH_COMBOBOX_Z_INDEX}
    >
      <Combobox.Target>
        <TextInput
          placeholder={placeholder}
          size="md"
          leftSection={<IconSearch size={18} />}
          rightSection={isLoading ? <Loader size="xs" /> : null}
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.currentTarget.value);
            combobox.openDropdown();
          }}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <ScrollAreaAutosize mah={SEARCH_COMBOBOX_MAX_HEIGHT} type="scroll">
          <Combobox.Options>
            {options.length > 0 ? (
              options
            ) : (
              <Combobox.Empty>Ничего не найдено</Combobox.Empty>
            )}
          </Combobox.Options>
        </ScrollAreaAutosize>
      </Combobox.Dropdown>
    </Combobox>
  );
}
