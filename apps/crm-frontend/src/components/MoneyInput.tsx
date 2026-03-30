import { NumberInput, type NumberInputProps } from "@mantine/core";

export function MoneyInput({ onFocus, ...props }: NumberInputProps) {
  return (
    <NumberInput
      suffix=" ₸"
      thousandSeparator=" "
      allowNegative={false}
      hideControls
      decimalScale={0}
      min={0}
      {...props}
      onFocus={(event) => {
        const input = event.currentTarget;
        setTimeout(() => {
          input.select();
        }, 0);
        onFocus?.(event);
      }}
    />
  );
}
