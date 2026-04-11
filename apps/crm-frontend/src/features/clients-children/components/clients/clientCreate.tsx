import { Stack, Group, TextInput, Button, Divider } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { CreateClientRequestSchema } from "@costumes/shared";
import { IMaskInput } from "react-imask";
import { useCreateClient } from "../../hooks/useClients";
import type { ClientCreateFormProps } from "../../types/clientTypes";

export function ClientCreateForm({ onCreated }: ClientCreateFormProps) {
  const createClientMutation = useCreateClient();

  const form = useForm({
    initialValues: { name: "", phone: "" },
    validate: zodResolver(CreateClientRequestSchema),
  });

  const handleSubmit = (values: typeof form.values) => {
    createClientMutation.mutate(
      { name: values.name, phone: values.phone },
      {
        onSuccess: (createdClient) => {
          onCreated({
            id: createdClient.clientId.toString(),
            name: createdClient.name,
            phone: createdClient.phone,
          });
          form.reset();
        },
      },
    );
  };

  return (
    <>
      <Divider label="Новый клиент" labelPosition="center" mb="sm" />
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="xs">
          <Group grow align="flex-start">
            <TextInput
              label="Имя и Фамилия клиента"
              placeholder="Введите имя клиента"
              {...form.getInputProps("name")}
            />
            <TextInput
              label="Телефон"
              placeholder="+7 (___) ___-__-__"
              error={form.errors.phone}
              value={form.values.phone}
              type="tel"
              inputMode="tel"
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
          </Group>
          <Button
            type="submit"
            fullWidth
            leftSection={<IconCheck size={16} />}
            variant="light"
            loading={createClientMutation.isPending}
          >
            Сохранить и выбрать
          </Button>
        </Stack>
      </form>
    </>
  );
}
