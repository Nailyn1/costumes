import type { GetVisitsForReturnDto } from "@costumes/shared";
import { Modal, Text, Center, Loader } from "@mantine/core";
import { ReturnFormContent } from "./ReturnFormContent";

interface ReturnModalProps {
  opened: boolean;
  onClose: () => void;
  visitId: number | null;
  isMobile: boolean;
  data: GetVisitsForReturnDto | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function ReturnModal({
  opened,
  onClose,
  visitId,
  isMobile,
  data,
  isLoading,
  isError,
}: ReturnModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={700}>Возврат визита {data ? `#${data.visitCode}` : ""}</Text>
      }
      size="lg"
      fullScreen={isMobile}
      closeButtonProps={{
        size: "lg",
        iconSize: 24,
      }}
    >
      {isLoading && (
        <Center p="xl" mih={200}>
          <Loader color="blue" />
        </Center>
      )}

      {isError && (
        <Center p="xl" mih={200}>
          <Text c="red">Не удалось загрузить данные визита</Text>
        </Center>
      )}

      {data && visitId && !isLoading && !isError && (
        <ReturnFormContent data={data} visitId={visitId} onClose={onClose} />
      )}
    </Modal>
  );
}
