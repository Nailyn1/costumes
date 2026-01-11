import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Title,
  Stack,
  Text,
  Divider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  IconCalendarPlus,
  IconTag,
  IconPackageExport,
  IconPackageImport,
  IconCalendarStats,
  IconUserCircle,
} from "@tabler/icons-react";

export function MainLayout() {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();

  const mainLinks = [
    { link: "/bookings/new", label: "Создать бронь", icon: IconCalendarPlus },
    {
      link: "/bookings/issue",
      label: "Выдача костюмов",
      icon: IconPackageExport,
    },
    {
      link: "/bookings/return",
      label: "Возврат костюмов",
      icon: IconPackageImport,
    },
    {
      link: "/bookings/schedule",
      label: "Просмотр брони",
      icon: IconCalendarStats,
    },
    { link: "/bookings/unrecorded", label: "Незаписанные", icon: IconTag },
    { link: "/profile", label: "Профиль", icon: IconUserCircle },
  ];

  const renderNavLink = (link: (typeof mainLinks)[0]) => (
    <NavLink
      key={link.link}
      component={Link}
      to={link.link}
      label={link.label}
      leftSection={<link.icon size="1.2rem" stroke={1.5} />}
      active={location.pathname === link.link}
      onClick={() => {
        if (opened) toggle();
      }}
      variant="light"
      color="blue"
      styles={{
        root: { borderRadius: "8px", marginBottom: "4px" },
        label: { fontWeight: 500 },
      }}
    />
  );

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 280,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Title order={4} c="blue.7" style={{ letterSpacing: "1px" }}>
            PROKAT PUPAVKA
          </Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          <Text size="xs" fw={700} c="dimmed" mb="xs" tt="uppercase">
            Операции
          </Text>
          <Stack gap={0}>{mainLinks.map(renderNavLink)}</Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Divider my="sm" />
          <Text size="xs" c="dimmed" ta="center">
            v1.0.4 • 2026
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
