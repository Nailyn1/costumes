import { Drawer, type DrawerProps } from "@mantine/core";

/** Отдельная мобильная оболочка фильтра; поля и применение общие с ПК. */
export function VisitMobileFilters({
  opened,
  onClose,
  children,
}: Pick<DrawerProps, "opened" | "onClose" | "children">) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Фильтр по дате выдачи"
      position="bottom"
      size="100%"
    >
      {children}
    </Drawer>
  );
}
