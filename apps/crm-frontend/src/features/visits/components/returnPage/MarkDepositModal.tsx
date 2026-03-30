import { Modal, Textarea, Button, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMarkDepositReturned } from "src/features/visits/hooks/useVisits";

interface MarkDepositModalProps {
  opened: boolean;
  onClose: () => void;
  visitId: number | undefined;
  clientName: string;
}

export function MarkDepositModal({
  opened,
  onClose,
  visitId,
  clientName,
}: MarkDepositModalProps) {
  const mutation = useMarkDepositReturned();
  const form = useForm({ initialValues: { notes: "" } });

  const handleConfirm = form.onSubmit((values) => {
    if (!visitId) return;
    mutation.mutate(
      { visitId, notes: values.notes },
      {
        onSuccess: () => {
          form.reset();
          onClose();
        },
      },
    );
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Возврат залога"
      centered
      size="sm"
    >
      <form onSubmit={handleConfirm}>
        <Stack>
          <Text size="sm">
            Вы возвращаете залог клиенту <b>{clientName}</b>. Можно добавить
            примечание:
          </Text>
          <Textarea
            placeholder="Например: забрали 29.03, больше им не сдавать..."
            {...form.getInputProps("notes")}
          />
          <Button
            fullWidth
            color="green"
            type="submit"
            loading={mutation.isPending}
          >
            Подтвердить возврат
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
