import { useState, useMemo, memo } from "react";
import { Select, Loader } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import type { CostumeSearchAvailableFieldProps } from "../types/costumeTypes";
import { useSearchAvailableCostumes } from "../hooks/useCostumes";

export const CostumeSearchAvailableField = memo(
  function CostumeSearchAvailableField({
    value,
    onSelect,
    error,
    startDateTime,
    endDateTime,
    issueTimeFrom,
    returnTimeUntil,
  }: CostumeSearchAvailableFieldProps) {
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebouncedValue(search, 400);

    const apiStartDate = `${startDateTime}T${issueTimeFrom}`;
    const apiEndDate = `${endDateTime}T${returnTimeUntil}`;

    const { data, isLoading } = useSearchAvailableCostumes(
      debouncedSearch,
      apiStartDate,
      apiEndDate,
    );

    const selectData = useMemo(() => {
      return (
        data?.map((costume) => {
          const isIssued = costume.status === "issued";

          return {
            value: costume.costumeId.toString(),
            // Добавляем пометку прямо в текст для простого поиска
            label: `${costume.name} (${costume.inventoryCode})${isIssued ? " — [ЗАНЯТ]" : ""}`,
            // Отключаем возможность выбора, если статус "issued"
            disabled: isIssued,
            // Пробрасываем статус дальше для кастомного рендеринга
            status: costume.status,
          };
        }) || []
      );
    }, [data]);

    const handleChange = (val: string | null) => {
      if (!val) {
        onSelect(null);
        return;
      }
      const costume = data?.find((c) => c.costumeId.toString() === val);
      if (costume) {
        onSelect(costume);
        setSearch("");
      }
    };
    return (
      <Select
        label=""
        searchable
        searchValue={search}
        onSearchChange={setSearch}
        data={selectData}
        value={value}
        onChange={handleChange}
        error={error}
        nothingFoundMessage={isLoading ? "Поиск..." : "Костюмы не найдены"}
        rightSection={isLoading ? <Loader size="xs" /> : null}
        filter={({ options }) => options}
      />
    );
  },
);
