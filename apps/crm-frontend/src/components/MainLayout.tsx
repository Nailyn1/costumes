import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Container,
  Title,
  Button,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Outlet, Link, useLocation } from "react-router-dom";

export function MainLayout() {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();

  const links = [
    { link: "/bookings", label: "Создать бронь" },
    { link: "/bookings/all", label: "Все брони" },
    { link: "/profile", label: "Профиль" },
  ];

  const items = links.map((link) => (
    <NavLink
      key={link.label}
      component={Link}
      to={link.link}
      label={link.label}
      active={location.pathname === link.link}
      onClick={toggle}
      variant="filled"
      color="blue"
      style={{ borderRadius: "8px" }}
    />
  ));

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: "sm",
        collapsed: { desktop: true, mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header bg="blue.7">
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between">
            <Title order={3} c="white">
              ProkatPupavka
            </Title>
            <Group gap={5} visibleFrom="sm">
              {links.map((link) => (
                <Button
                  key={link.label}
                  component={Link}
                  to={link.link}
                  variant={location.pathname === link.link ? "white" : "subtle"}
                  color={location.pathname === link.link ? "blue" : "gray.0"}
                  size="sm"
                >
                  {link.label}
                </Button>
              ))}
            </Group>

            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              color="white"
            />
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Navbar p="md">{items}</AppShell.Navbar>

      <AppShell.Main>
        <Container size="lg">
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
