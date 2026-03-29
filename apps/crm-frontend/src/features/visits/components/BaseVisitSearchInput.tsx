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
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { formatPhoneNumber } from "src/utills/formatters";

interface UnifiedSearchItem {
  visitId: number;
  visitCode: string;
  clientName: string;
  clientPhone: string;
  childrenNames: string;
  costumesNames: string;
}

interface BaseVisitSearchInputProps {
  onSelectVisit: (visitId: number) => void;
  useSearchHook: (query: string) => {
    data: UnifiedSearchItem[] | undefined;
    isFetching: boolean;
  };
  placeholder?: string;
}

export function BaseVisitSearchInput({
  onSelectVisit,
  useSearchHook,
  placeholder = "Поиск...",
}: BaseVisitSearchInputProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchQuery, 400);

  const { data: searchResults, isFetching } = useSearchHook(debouncedQuery);

  const handleOptionSubmit = (val: string) => {
    onSelectVisit(Number(val));
    setSearchQuery("");
    combobox.closeDropdown();
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  };

  const isValidSearch = searchQuery.trim().length >= 2;

  const options = isValidSearch
    ? (searchResults || []).map((visit) => (
        <Combobox.Option value={String(visit.visitId)} key={visit.visitId}>
          <Group wrap="nowrap" align="flex-start">
            <Badge size="lg" variant="light" mt={2}>
              #{visit.visitCode}
            </Badge>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Group gap={6} align="center" wrap="wrap" style={{ rowGap: 0 }}>
                <Text size="md" fw={500}>
                  {visit.clientName}
                </Text>
                <Text size="md" fw={500}>
                  {formatPhoneNumber(visit.clientPhone)}
                </Text>
              </Group>

              <Text size="md" c="dimmed" truncate="end">
                {visit.childrenNames} — {visit.costumesNames}
              </Text>
            </Box>
          </Group>
        </Combobox.Option>
      ))
    : [];

  return (
    <Combobox
      onOptionSubmit={handleOptionSubmit}
      store={combobox}
      withinPortal={false}
    >
      <Combobox.Target>
        <TextInput
          placeholder={placeholder}
          size="md"
          leftSection={<IconSearch size={18} />}
          rightSection={isFetching ? <Loader size="xs" /> : null}
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.currentTarget.value);
            combobox.openDropdown();
          }}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options>
          {options.length > 0 ? (
            options
          ) : (
            <Combobox.Empty>Ничего не найдено</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
