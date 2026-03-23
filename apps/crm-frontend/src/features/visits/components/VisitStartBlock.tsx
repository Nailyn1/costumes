import { SimpleGrid, Text, Stack } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import type { VisitBlockProps } from "../types/visitTypes";
import { SmartDateInput } from "./SmartDateInput";
import dayjs from "dayjs";

export function VisitStartBlock({ values, onChange, errors }: VisitBlockProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500} c="dimmed">
        Выдача
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <SmartDateInput
          label="Дата выдачи"
          value={values.startDateTime}
          onChange={(val) => onChange("startDateTime", val)}
          minDate={dayjs().format("YYYY-MM-DD")}
          error={errors?.startDateTime}
        />
        <TimeInput
          label="Забрать с"
          value={values.issueTimeFrom}
          onChange={(e) => onChange("issueTimeFrom", e.currentTarget.value)}
          error={errors?.issueTimeFrom}
        />
        <TimeInput
          label="Забрать до"
          value={values.issueTimeTo}
          onChange={(e) => onChange("issueTimeTo", e.currentTarget.value)}
          error={errors?.issueTimeTo}
        />
      </SimpleGrid>
    </Stack>
  );
}
