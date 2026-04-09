// src/features/visits/components/VisitSummaryPanel.tsx
import { Paper, Stack, Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMemo } from "react";
import { useCreateVisit, useVisitPreviewCode } from "../hooks/useVisits";
import { VisitPreviewModal } from "./VisitPreviewModal";
import type { UseFormReturnType } from "@mantine/form";
import type { BookingFormValues } from "../types/visitTypes";

interface VisitSummaryPanelProps {
  form: UseFormReturnType<BookingFormValues>;
  onSuccessfullyCreated?: () => void;
}

export function VisitSummaryPanel({
  form,
  onSuccessfullyCreated,
}: VisitSummaryPanelProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const { mutate: getCode, isPending } = useVisitPreviewCode();
  const { mutate: createVisit, isPending: isCreating } = useCreateVisit();

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
        const formattedCode = String(code);
        form.setFieldValue("visitCode", formattedCode);
        open();
      },
    });
  };

  const handleFinalSubmit = (sendNotification: boolean) => {
    const { values } = form;
    const payload = {
      visitCode: values.visitCode || "",
      startDateTime: values.startDateTime || "",
      endDateTime: values.endDateTime || "",
      issueTimeFrom: values.issueTimeFrom || "",
      issueTimeTo: values.issueTimeTo || "",
      returnTimeUntil: values.returnTimeUntil || "",
      clientId: Number(values.clientId),
      notes: values.notes || "",
      orders: values.orders.map((order) => ({
        childId: Number(order.childId),
        costumeId: Number(order.costumeId),
        rentPrice: Number(order.rentPrice) || 0,
        prepaymentAmount: Number(order.prepaymentAmount) || 0,
        notes: order.notes || "",
      })),
    };

    createVisit(
      { data: payload, sendNotification: sendNotification },
      {
        onSuccess: () => {
          if (onSuccessfullyCreated) {
            onSuccessfullyCreated();
          } else {
            form.reset();
          }
          close();
        },
      },
    );
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
        onSubmit={handleFinalSubmit}
        isSubmitting={isCreating}
      />
    </>
  );
}
