import { useCallback, memo } from "react";
import { Paper, Stack, Text, Divider } from "@mantine/core";
import { VisitStartBlock } from "./VisitStartBlock";
import { VisitEndBlock } from "./VisitEndBlock";
import type { VisitData, VisitSelectorProps } from "../types/visitTypes";
import { useQueryClient } from "@tanstack/react-query";

export const VisitSelector = memo(function VisitSelector({
  values,
  onChange,
  errors: externalErrors,
}: VisitSelectorProps) {
  const queryClient = useQueryClient();
  const validationErrors: Partial<Record<keyof VisitData, string>> = {};

  if (values.startDateTime && values.endDateTime) {
    if (values.startDateTime > values.endDateTime) {
      validationErrors.endDateTime =
        "Дата возврата не может быть раньше даты выдачи";
    }
  }

  if (values.issueTimeFrom && values.issueTimeTo) {
    if (values.issueTimeFrom > values.issueTimeTo) {
      validationErrors.issueTimeTo = "Время должно быть позже поля 'Забрать с'";
    }
  }

  const combinedErrors = { ...externalErrors, ...validationErrors };

  const toISODateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleFieldChange = useCallback(
    <K extends keyof VisitData>(key: K, value: VisitData[K]) => {
      let stringValue: string | null = null;

      if (value instanceof Date) {
        stringValue = toISODateString(value);
      } else {
        stringValue = value as string | null;
      }

      const newValues: VisitData = { ...values, [key]: stringValue };

      if (key === "startDateTime" && stringValue) {
        const dateObj = new Date(stringValue);

        if (!isNaN(dateObj.getTime())) {
          const nextDay = new Date(dateObj);
          nextDay.setDate(nextDay.getDate() + 1);
          newValues.endDateTime = toISODateString(nextDay);
        }
      }

      if (key === "endDateTime" && stringValue) {
        const currentEnd = new Date(stringValue);
        const currentStart = values.startDateTime
          ? new Date(values.startDateTime)
          : null;

        if (
          currentStart &&
          !isNaN(currentEnd.getTime()) &&
          currentEnd < currentStart
        ) {
          newValues.endDateTime = null;
        }
      }

      if (key === "startDateTime" || key === "endDateTime") {
        queryClient.removeQueries({
          queryKey: ["costumes", "list", "search"],
        });
      }
      onChange(newValues);
    },
    [values, onChange, queryClient],
  );
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xl">
        <Text fw={600}>2. Дата и время</Text>
        <VisitStartBlock
          values={values}
          onChange={handleFieldChange}
          errors={combinedErrors}
        />

        <Divider variant="dashed" labelPosition="center" />

        <VisitEndBlock
          values={values}
          onChange={handleFieldChange}
          errors={combinedErrors}
        />
      </Stack>
    </Paper>
  );
});
