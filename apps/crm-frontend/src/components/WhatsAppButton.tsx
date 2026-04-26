import {
  Button,
  ActionIcon,
  type ButtonProps,
  type ActionIconProps,
} from "@mantine/core";
import { IconBrandWhatsapp } from "@tabler/icons-react";

type CommonProps = {
  phone: string;
  message?: string;
  iconSize?: number;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

type AsButtonProps = CommonProps &
  Omit<ButtonProps, "leftSection" | "rightSection"> & {
    iconOnly?: false;
    children?: React.ReactNode;
  };

type AsIconProps = CommonProps &
  ActionIconProps & {
    iconOnly: true;
  };

type WhatsAppButtonProps = AsButtonProps | AsIconProps;

export function WhatsAppButton(props: WhatsAppButtonProps) {
  const cleanPhone = props.phone.replace(/\D/g, "");
  const waLink = props.message
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(props.message)}`
    : `https://wa.me/${cleanPhone}`;

  if (props.iconOnly) {
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      phone,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      message,
      iconSize = 20,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      iconOnly,
      onClick,
      ...iconProps
    } = props;

    return (
      <ActionIcon
        component="a"
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        color="green"
        onClick={onClick}
        {...iconProps}
      >
        <IconBrandWhatsapp size={iconSize} />
      </ActionIcon>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    phone,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    message,
    iconSize = 20,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    iconOnly,
    onClick,
    children = "WhatsApp",
    ...buttonProps
  } = props;

  return (
    <Button
      component="a"
      href={waLink}
      target="_blank"
      rel="noopener noreferrer"
      color="green"
      leftSection={<IconBrandWhatsapp size={iconSize} />}
      onClick={onClick}
      {...buttonProps}
    >
      {children}
    </Button>
  );
}
