import { SimpleGrid, Text, Stack } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import type { VisitBlockProps } from "../types/visitTypes";
import { SmartDateInput } from "./SmartDateInput";

export function VisitEndBlock({ values, onChange, errors }: VisitBlockProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500} c="dimmed">
        Возврат
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <SmartDateInput
          label="Дата возврата"
          value={values.endDateTime}
          onChange={(val) => onChange("endDateTime", val)}
          minDate={values.startDateTime}
          error={errors?.endDateTime}
        />
        <TimeInput
          label="Вернуть до"
          value={values.returnTimeUntil as string | undefined}
          onChange={(e) => onChange("returnTimeUntil", e.currentTarget.value)}
          error={errors?.returnTimeUntil}
        />
      </SimpleGrid>
    </Stack>
  );
}
