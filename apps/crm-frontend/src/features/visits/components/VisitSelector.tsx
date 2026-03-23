import { useCallback, memo } from "react";
import { Paper, Stack, Text, Divider } from "@mantine/core";
import { VisitStartBlock } from "./VisitStartBlock";
import { VisitEndBlock } from "./VisitEndBlock";
import type { VisitData, VisitSelectorProps } from "../types/visitTypes";

export const VisitSelector = memo(function VisitSelector({
  values,
  onChange,
  errors: externalErrors,
}: VisitSelectorProps) {
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

  const handleFieldChange = useCallback(
    <K extends keyof VisitData>(key: K, value: VisitData[K]) => {
      const newValues: VisitData = { ...values, [key]: value };
      if (key === "startDateTime" && value instanceof Date) {
        if (newValues.endDateTime && value > newValues.endDateTime) {
          newValues.endDateTime = null;
        }
      }

      if (key === "endDateTime" && value instanceof Date) {
        if (newValues.startDateTime && value < newValues.startDateTime) {
          newValues.endDateTime = null;
        }
      }
      onChange(newValues);
    },
    [values, onChange],
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
