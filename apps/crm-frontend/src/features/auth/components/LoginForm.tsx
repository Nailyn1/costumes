import { Button, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { schemas } from "@project/shared";
import { useLogin } from "../hooks/useLogin";

export const LoginForm = () => {
  const loginMutation = useLogin();

  const form = useForm({
    initialValues: {
      login: "",
      password: "",
    },
    validate: zodResolver(schemas.Auth_LoginRequest),
  });

  const onSubmit = form.onSubmit((values) => {
    loginMutation.mutate(values);
  });

  return (
    <Paper radius="md" p="xl" withBorder shadow="md">
      <Stack gap="md">
        <Title order={2}>Вход в систему</Title>

        <Text size="sm" c="dimmed">
          Введите логин и пароль для доступа к CRM
        </Text>

        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            <TextInput
              label="Логин"
              placeholder="Введите логин"
              {...form.getInputProps("login")}
            />

            <TextInput
              label="Пароль"
              type="password"
              placeholder="Введите пароль"
              {...form.getInputProps("password")}
            />

            <Button type="submit" loading={loginMutation.isPending} fullWidth>
              Войти
            </Button>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
};
