import { Stack, TextInput, Button } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useCreateCostume } from "../hooks/useCostumes";
import type { CostumeCreateFormProps } from "../types/costumeTypes";

export function CostumeCreateForm({
  onCreated,
  buttonText = "Создать и выбрать",
}: CostumeCreateFormProps) {
  const createMutation = useCreateCostume();

  const form = useForm({
    initialValues: { name: "" },
    validate: {
      name: (v) => {
        if (v.trim().length < 2) {
          return "Слишком короткое название костюма";
        }
        return null;
      },
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    createMutation.mutate(
      { name: values.name },
      {
        onSuccess: (data) => {
          onCreated({
            costumeId: data.costumeId,
            name: data.name,
            inventoryCode: data.inventoryCode,
          });
          form.reset();
        },
      },
    );
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="xs">
        <TextInput
          label="Название нового костюма"
          placeholder="Введите название"
          {...form.getInputProps("name")}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              form.onSubmit(handleSubmit)();
            }
          }}
        />
        <Button
          type="submit"
          size="xs"
          loading={createMutation.isPending}
          fullWidth
        >
          {buttonText}
        </Button>
      </Stack>
    </form>
  );
}
