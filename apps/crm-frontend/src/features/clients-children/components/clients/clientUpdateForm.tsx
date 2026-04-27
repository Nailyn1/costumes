import { Stack, Group, TextInput, Button } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { IMaskInput } from "react-imask";
import { UpdateClientRequestSchema } from "@costumes/shared";
import { useUpdateClient } from "../../hooks/useClients";
import type { ClientUpdateFormProps } from "../../types/clientTypes";

export function ClientUpdateForm({
  client,
  onSuccess,
  onCancel,
}: ClientUpdateFormProps) {
  const updateMutation = useUpdateClient();

  const form = useForm({
    initialValues: {
      name: client.name,
      phone: client.phone,
    },
    validate: zodResolver(UpdateClientRequestSchema),
  });

  const handleSubmit = (values: typeof form.values) => {
    updateMutation.mutate(
      {
        clientId: Number(client.id),
        data: values,
      },
      {
        onSuccess: (res) => {
          onSuccess({
            ...client,
            name: res.name,
            phone: res.phone,
          });
        },
      },
    );
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="xs">
        <TextInput
          label="Имя и Фамилия"
          placeholder="Имя"
          {...form.getInputProps("name")}
        />
        <TextInput
          label="Телефон"
          {...form.getInputProps("phone")}
          renderRoot={({ children, ...others }) => (
            <IMaskInput
              {...others}
              mask="+7 (000) 000-00-00"
              lazy={false}
              unmask={true}
              value={form.values.phone?.replace("+7", "") || ""}
              onAccept={(value) => {
                form.setFieldValue("phone", value ? `+7${value}` : "");
              }}
            >
              {children}
            </IMaskInput>
          )}
        />
        <Group grow gap="xs">
          <Button
            variant="light"
            color="gray"
            leftSection={<IconX size={16} />}
            onClick={onCancel}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            leftSection={<IconCheck size={16} />}
            loading={updateMutation.isPending}
          >
            Сохранить
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
