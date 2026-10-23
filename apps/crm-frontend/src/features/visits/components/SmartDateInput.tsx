import React, { useState, type KeyboardEvent } from "react";
import { TextInput, ActionIcon, Popover, Box } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";
import dayjs from "dayjs";
import { parseSmartDate } from "../utils/bookingForm";

interface SmartDateInputProps {
  label: string;
  value: string | null;
  onChange: (val: string | null) => void;
  error?: React.ReactNode;
  minDate?: string | null;
  disabled?: boolean;
}
export function SmartDateInput({
  label,
  value,
  onChange,
  error,
  minDate,
  disabled = false,
}: SmartDateInputProps) {
  const [inputValue, setInputValue] = useState(
    value ? dayjs(value).format("DD.MM") : "",
  );
  const [prevValue, setPrevValue] = useState<string | null>(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(value ? dayjs(value).format("DD.MM") : "");
  }

  const [opened, setOpened] = useState(false);

  const commitChange = (rawVal: string) => {
    if (!rawVal) {
      onChange(null);
      return;
    }

    const parsed = parseSmartDate(rawVal);
    if (parsed) {
      onChange(parsed);
      return;
    }

    // Если ничего не подошло, но дата уже была - возвращаем красивый вид
    if (value) {
      setInputValue(dayjs(value).format("DD.MM"));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitChange(inputValue);
    }
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  return (
    <Box>
      <TextInput
        label={label}
        placeholder="Напр: 4 или 15.05"
        value={inputValue}
        error={error}
        disabled={disabled}
        onChange={(e) =>
          setInputValue(e.currentTarget.value.replace(/[^0-9.]/g, ""))
        }
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={() => commitChange(inputValue)}
        rightSection={
          <Popover
            opened={opened}
            onChange={setOpened}
            position="bottom-end"
            shadow="md"
          >
            <Popover.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                disabled={disabled}
                onClick={() => setOpened((o) => !o)}
              >
                <IconCalendar size="1.2rem" />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown p={0}>
              <DatePicker
                // Конвертируем string -> Date для календаря
                value={value ? dayjs(value).toDate() : null}
                onChange={(d) => {
                  // Конвертируем Date -> string для API/Формы
                  onChange(d ? dayjs(d).format("YYYY-MM-DD") : null);
                  setOpened(false);
                }}
                minDate={minDate ? dayjs(minDate).toDate() : undefined}
                locale="ru"
              />
            </Popover.Dropdown>
          </Popover>
        }
      />
    </Box>
  );
}
