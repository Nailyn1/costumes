import { useState, useMemo, useCallback, memo } from "react";
import { Select, Loader, Group, Text, Badge } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useSearchClients } from "../../hooks/useClients";
import { formatPhoneNumber } from "src/utills/formatters";
import type { ClientSearchFieldProps } from "../../types/clientTypes";

export const ClientSearchField = memo(function ClientSearchField({
  value,
  onSelect,
  error,
}: ClientSearchFieldProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 400);

  const { data, isLoading } = useSearchClients(debouncedSearch);

  const selectData = useMemo(() => {
    return (
      data?.map((client) => ({
        value: client.clientId.toString(),
        label: `${client.name} ${formatPhoneNumber(client.phone)}`,
        disabled: client.isBlacklisted,
      })) || []
    );
  }, [data]);

  const handleChange = useCallback(
    (val: string | null) => {
      if (!val) {
        onSelect(null);
        return;
      }

      const client = data?.find((c) => c.clientId.toString() === val);
      if (client) {
        onSelect({
          id: val,
          name: client.name,
          phone: client.phone,
          children: client.children,
        });

        setSearch("");
      }
    },
    [data, onSelect],
  );
  return (
    <Select
      label="Поиск клиента"
      placeholder="Имя или телефон"
      searchable
      searchValue={search}
      onSearchChange={setSearch}
      data={selectData}
      value={value}
      onChange={handleChange}
      error={error}
      nothingFoundMessage={isLoading ? "Поиск..." : "Клиент не найден"}
      rightSection={isLoading ? <Loader size="xs" /> : null}
      filter={({ options }) => options}
      renderOption={({ option }) => (
        <Group justify="space-between" w="100%" wrap="nowrap">
          <Text size="sm" c={option.disabled ? "dimmed" : undefined} truncate>
            {option.label}
          </Text>
          {option.disabled && (
            <Badge color="red" variant="light" size="lg">
              В ЧС
            </Badge>
          )}
        </Group>
      )}
    />
  );
});
