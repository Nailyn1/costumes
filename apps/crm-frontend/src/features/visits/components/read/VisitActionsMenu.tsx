import { ActionIcon, Menu } from "@mantine/core";
import { IconDotsVertical } from "@tabler/icons-react";

export interface VisitMenuAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}

export function VisitActionsMenu({ actions }: { actions: VisitMenuAction[] }) {
  if (!actions.length) return null;
  return (
    <Menu position="bottom-end" withinPortal={false}>
      <Menu.Target>
        <ActionIcon variant="subtle" aria-label="Действия визита">
          <IconDotsVertical size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {actions.map((action) => (
          <Menu.Item
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            color={action.color}
          >
            {action.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
