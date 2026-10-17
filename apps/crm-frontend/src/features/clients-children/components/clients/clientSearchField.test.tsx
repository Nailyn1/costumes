import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API_URL, server } from "../../../../../test/server";
import { renderWithProviders } from "../../../../../test/render";
import { ClientSearchField } from "./clientSearchField";

const clients = [
  {
    clientId: 1,
    name: "Алия",
    phone: "+77071234567",
    children: [{ childId: 10, name: "Маша" }],
    isBlacklisted: false,
  },
  {
    clientId: 2,
    name: "Алина",
    phone: "+77079998877",
    children: [],
    isBlacklisted: true,
    blacklistReason: "не вернула костюм",
  },
];

describe("ClientSearchField", () => {
  it("shows a blacklisted client as unavailable and lets the user pick a regular one", async () => {
    server.use(
      http.get(`${API_URL}/clients/search`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("q")).toBe("Али");
        return HttpResponse.json(clients);
      }),
    );
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ClientSearchField onSelect={onSelect} />);

    await user.type(screen.getByPlaceholderText("Имя или телефон"), "Али");

    const optionOf = (text: RegExp) =>
      screen.getByText(text).closest<HTMLElement>("[data-combobox-option]");

    await screen.findByText(/Алина/, undefined, { timeout: 3000 });
    const blacklisted = optionOf(/Алина/);
    expect(blacklisted).not.toBeNull();
    expect(blacklisted).toHaveAttribute("data-combobox-disabled", "true");
    expect(blacklisted).toHaveTextContent("В ЧС");

    await user.click(blacklisted as HTMLElement);
    expect(onSelect).not.toHaveBeenCalled();

    const regular = optionOf(/Алия/);
    expect(regular).not.toHaveAttribute("data-combobox-disabled");
    expect(regular).not.toHaveTextContent("В ЧС");

    await user.click(regular as HTMLElement);
    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith({
        id: "1",
        name: "Алия",
        phone: "+77071234567",
        children: [{ childId: 10, name: "Маша" }],
      }),
    );
  });

  it("does not query the API for less than 2 characters", async () => {
    const handler = vi.fn(() => HttpResponse.json([]));
    server.use(http.get(`${API_URL}/clients/search`, handler));
    const user = userEvent.setup();
    renderWithProviders(<ClientSearchField onSelect={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("Имя или телефон"), "А");
    await new Promise((resolve) => setTimeout(resolve, 600)); // дебаунс 400 мс

    expect(handler).not.toHaveBeenCalled();
  });
});
