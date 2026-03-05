import { useState, type KeyboardEvent } from "react";
import { TextInput, ActionIcon, Popover, Box } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";
import dayjs from "dayjs";

interface SmartDateInputProps {
  label: string;
  value: string | null;
  onChange: (val: string | null) => void;
  error?: React.ReactNode;
  minDate?: string | null;
}

export function SmartDateInput({
  label,
  value,
  onChange,
  error,
  minDate,
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

    const dayMatch = rawVal.match(/^\d{1,2}$/);
    if (dayMatch) {
      const day = parseInt(dayMatch[0], 10);
      if (day >= 1 && day <= 31) {
        const now = dayjs();
        let smartDate = now.date(day).startOf("day");

        if (smartDate.isBefore(now, "day")) {
          smartDate = smartDate.add(1, "month");
        }

        if (smartDate.isValid()) {
          onChange(smartDate.format("YYYY-MM-DD"));
        }
        return;
      }
    }

    // Если введено DD.MM (например 15.05)
    const fullMatch = rawVal.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (fullMatch) {
      const day = parseInt(fullMatch[1], 10);
      const month = parseInt(fullMatch[2], 10) - 1; // в JS месяцы 0-11
      const smartDate = dayjs().month(month).date(day).startOf("day");

      if (smartDate.isValid()) {
        onChange(smartDate.format("YYYY-MM-DD"));
      }
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

  return (
    <Box>
      <TextInput
        label={label}
        placeholder="Напр: 4 или 15.05"
        value={inputValue}
        error={error}
        onChange={(e) =>
          setInputValue(e.currentTarget.value.replace(/[^0-9.]/g, ""))
        }
        onKeyDown={handleKeyDown}
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
