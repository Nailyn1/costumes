import { Group, Select } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import { IconCalendarEvent } from "@tabler/icons-react";
import type { GetReservedParams } from "../services/visits.service";
import { useState } from "react";
import dayjs from "dayjs";

interface IssueFiltersProps {
  filters: GetReservedParams;
  onChange: (newFilters: GetReservedParams) => void;
  preset: string;
  onPresetChange: (preset: string) => void;
}

export function IssueFilters({
  filters,
  onChange,
  preset,
  onPresetChange,
}: IssueFiltersProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [customDates, setCustomDates] = useState<
    [string | null, string | null]
  >([null, null]);
  const handlePresetChange = (value: string | null) => {
    if (!value) return;
    onPresetChange(value);

    const today = dayjs().format("YYYY-MM-DD");
    const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
    const nextWeek = dayjs().add(6, "day").format("YYYY-MM-DD");

    switch (value) {
      case "today":
        onChange({ ...filters, startDate: today, endDate: today });
        break;
      case "tomorrow":
        onChange({ ...filters, startDate: tomorrow, endDate: tomorrow });
        break;
      case "week":
        onChange({ ...filters, startDate: today, endDate: nextWeek });
        break;
      case "all":
        onChange({ ...filters, startDate: undefined, endDate: undefined });
        break;
      case "custom":
        setCustomDates([null, null]);
        onChange({ ...filters, startDate: undefined, endDate: undefined });
        break;
    }
  };

  const handleCustomDateChange = (val: [string | null, string | null]) => {
    setCustomDates(val);
    if ((val[0] && val[1]) || (!val[0] && !val[1])) {
      onChange({
        ...filters,
        startDate: val[0] ? dayjs(val[0]).format("YYYY-MM-DD") : undefined,
        endDate: val[1] ? dayjs(val[1]).format("YYYY-MM-DD") : undefined,
      });
    }
  };

  return (
    <Group
      align="flex-start"
      gap="sm"
      mb="lg"
      style={{ flexDirection: isMobile ? "column" : "row" }}
    >
      <Select
        value={preset}
        onChange={handlePresetChange}
        allowDeselect={false}
        leftSection={<IconCalendarEvent size={18} />}
        data={[
          { value: "today", label: "Сегодня" },
          { value: "tomorrow", label: "Завтра" },
          { value: "week", label: "Неделя" },
          { value: "all", label: "Показать все" },
          { value: "custom", label: "Выбрать период" },
        ]}
        size="md"
        w={isMobile ? "100%" : 220}
        styles={{
          input: {
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
          },
        }}
      />

      {preset === "custom" && (
        <DatePickerInput
          type="range"
          placeholder="С... по..."
          value={customDates}
          onChange={handleCustomDateChange}
          clearable
          size="md"
          w={isMobile ? "100%" : 280}
        />
      )}
    </Group>
  );
}
