import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { SelectionManager } from "./SelectionManager";

describe("inline entity creation inside a modal", () => {
  it("does not mount a hidden autofocus form and unmounts it when creation is cancelled", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SelectionManager
        label="Ребёнок"
        isSelected={false}
        renderSelected={null}
        renderSearch={<input aria-label="Поиск ребёнка" />}
        renderCreate={<input autoFocus aria-label="Имя нового ребёнка" />}
      />,
    );
    expect(
      screen.queryByLabelText("Имя нового ребёнка"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByTitle("Добавить"));
    expect(screen.getByLabelText("Имя нового ребёнка")).toHaveFocus();
    await user.click(screen.getByTitle("Отменить"));
    expect(
      screen.queryByLabelText("Имя нового ребёнка"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Поиск ребёнка")).toBeInTheDocument();
  });
});
