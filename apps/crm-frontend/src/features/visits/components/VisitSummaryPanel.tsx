// src/features/visits/components/VisitSummaryPanel.tsx
import { Paper, Stack, Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMemo } from "react";
import { useVisitPreviewCode } from "../hooks/useVisits";
import { VisitPreviewModal } from "./VisitPreviewModal";
import type { UseFormReturnType } from "@mantine/form";
import type { BookingFormValues } from "../types/visitTypes";

interface VisitSummaryPanelProps {
  form: UseFormReturnType<BookingFormValues>;
}

export function VisitSummaryPanel({ form }: VisitSummaryPanelProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const { mutate: getCode, isPending } = useVisitPreviewCode();

  const totals = useMemo(() => {
    return form.values.orders.reduce(
      (acc, order) => ({
        rent: acc.rent + (Number(order.rentPrice) || 0),
        prepayment: acc.prepayment + (Number(order.prepaymentAmount) || 0),
      }),
      { rent: 0, prepayment: 0 },
    );
  }, [form.values.orders]);

  const handleCheck = () => {
    const validation = form.validate();
    if (validation.hasErrors) return;

    getCode(undefined, {
      onSuccess: (code) => {
        console.log(code);
        const formattedCode = String(code);
        form.setFieldValue("visitCode", formattedCode);
        open();
      },
    });
  };

  return (
    <>
      <Paper withBorder p="xl" radius="md" shadow="sm" mt="xl" bg="white">
        <Stack gap="xs">
          <Button size="lg" fullWidth onClick={handleCheck} loading={isPending}>
            Проверить
          </Button>
        </Stack>
      </Paper>

      <VisitPreviewModal
        opened={opened}
        onClose={close}
        form={form}
        totalRent={totals.rent}
        totalPrepayment={totals.prepayment}
      />
    </>
  );
}
