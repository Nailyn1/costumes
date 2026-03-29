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
import { useSearchVisits } from "../../hooks/useVisits";
import { formatPhoneNumber } from "src/utills/formatters";

interface VisitSearchInputProps {
  onSelectVisit: (visitId: number) => void;
}

export function IssueSearchInput({ onSelectVisit }: VisitSearchInputProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchQuery, 400);

  const { data: searchResults, isFetching } = useSearchVisits(debouncedQuery);

  const handleOptionSubmit = (val: string) => {
    const visitId = Number(val);

    onSelectVisit(visitId);
    setSearchQuery("");
    combobox.closeDropdown();
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
                <Text size="md" fw={500} style={{ wordBreak: "break-word" }}>
                  {visit.clientName}
                </Text>

                <Text size="md" fw={500} style={{ whiteSpace: "nowrap" }}>
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
          placeholder="Поиск (код, имя, костюм, телефон)..."
          size="md"
          leftSection={<IconSearch size={18} />}
          rightSection={isFetching ? <Loader size="xs" /> : null}
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.currentTarget.value);
            combobox.openDropdown();
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => combobox.closeDropdown()}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {options.length > 0 ? (
            options
          ) : searchQuery.trim().length >= 2 && !isFetching ? (
            <Combobox.Empty>Ничего не найдено</Combobox.Empty>
          ) : (
            <Combobox.Empty>Введите минимум 2 символа...</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
