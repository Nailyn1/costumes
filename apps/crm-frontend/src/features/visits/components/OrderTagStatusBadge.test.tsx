import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MantineProvider } from "@mantine/core";
import { OrderTagStatusBadge } from "./OrderTagStatusBadge";

describe("OrderTagStatusBadge", () => {
  it.each([
    ["written", "Бирка есть"],
    ["not_written", "Нет бирки"],
    ["not_required", "Бирка не требуется"],
  ] as const)("shows the correct label for %s", (tagStatus, label) => {
    render(
      <MantineProvider>
        <OrderTagStatusBadge tagStatus={tagStatus} />
      </MantineProvider>,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
