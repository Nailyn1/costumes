import { Fieldset, Group, Stack, TextInput } from "@mantine/core";
import type { ReactNode } from "react";
import { ChildSelector } from "src/features/clients-children/components/children/ChildSelector";
import { CostumeSelector } from "src/features/costumes/components/costumeSelector";
import { MoneyInput } from "src/components/MoneyInput";

export interface OrderSelectionValue {
  childId: number | null;
  costumeId: number | null;
  rentPrice: number | string;
  notes: string;
}

export interface OrderSelectionFieldsProps {
  clientId: number | null;
  value: OrderSelectionValue;
  onChange: (value: OrderSelectionValue) => void;
  startDateTime: string | null;
  endDateTime: string | null;
  issueTimeFrom: string;
  returnTimeUntil: string;
  errors?: Partial<Record<keyof OrderSelectionValue, ReactNode>>;
  disabled?: boolean;
  rightControl?: ReactNode;
  /** Reserved for visit-edit flows once the availability API supports exclusions. */
  excludeVisitId?: number;
}

/** Shared child, costume, rent and notes controls without endpoint assumptions. */
export function OrderSelectionFields({
  clientId,
  value,
  onChange,
  startDateTime,
  endDateTime,
  issueTimeFrom,
  returnTimeUntil,
  errors,
  disabled,
  rightControl,
}: OrderSelectionFieldsProps) {
  return (
    <Fieldset
      variant="unstyled"
      disabled={disabled}
    >
      <Stack gap="sm">
        <ChildSelector
          clientId={clientId}
          value={value.childId}
          onChange={(childId) => onChange({ ...value, childId })}
          error={errors?.childId}
        />
        <CostumeSelector
          value={value.costumeId?.toString() ?? null}
          onChange={(costumeId) =>
            onChange({ ...value, costumeId: costumeId ? Number(costumeId) : null })
          }
          error={errors?.costumeId}
          startDateTime={startDateTime}
          endDateTime={endDateTime}
          issueTimeFrom={issueTimeFrom}
          returnTimeUntil={returnTimeUntil}
        />
        <Group grow align="flex-start">
          <MoneyInput
            label="Аренда"
            placeholder="0 ₸"
            value={value.rentPrice}
          onChange={(rentPrice) =>
            onChange({
              ...value,
              rentPrice: typeof rentPrice === "number" ? rentPrice : String(rentPrice),
            })
          }
            error={errors?.rentPrice}
            disabled={disabled}
          />
          {rightControl}
        </Group>
        <TextInput
          label="Заметка"
          placeholder="Особенности заказа..."
          value={value.notes}
          onChange={(event) =>
            onChange({ ...value, notes: event.currentTarget.value })
          }
          error={errors?.notes}
          disabled={disabled}
        />
      </Stack>
    </Fieldset>
  );
}
