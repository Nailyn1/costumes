import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API_URL, server } from "../../../../../test/server";
import { renderWithProviders } from "../../../../../test/render";
import { ClientSelector } from "./clientSelector";

const SEARCH_TIMEOUT = { timeout: 3000 };

const client = (isBlacklisted: boolean) => ({
  clientId: 2,
  name: "Алина",
  phone: "+77079998877",
  children: [],
  isBlacklisted,
  whatsappConfirmed: false,
});

const optionOf = (text: RegExp) =>
  screen.getByText(text).closest<HTMLElement>("[data-combobox-option]");

describe("ClientSelector in the booking form", () => {
  it("does not let the staff pick a blacklisted client, but does after the ban is lifted", async () => {
    // сервер «снимает» запрет между двумя поисками
    let blacklisted = true;
    server.use(
      http.get(`${API_URL}/clients/search`, () =>
        HttpResponse.json([client(blacklisted)]),
      ),
    );
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ClientSelector onChange={onChange} />);
    const input = screen.getByPlaceholderText("Имя или телефон");

    await user.type(input, "Алина");
    await screen.findByText(/Алина/, undefined, SEARCH_TIMEOUT);
    expect(optionOf(/Алина/)).toHaveAttribute("data-combobox-disabled", "true");
    expect(optionOf(/Алина/)).toHaveTextContent("В ЧС");
    await user.click(optionOf(/Алина/) as HTMLElement);
    expect(onChange).not.toHaveBeenCalled();

    // запрет снят на странице «Клиенты» — новый поиск видит клиента доступным
    blacklisted = false;
    await user.clear(input);
    await user.type(input, "Алин");
    await waitFor(
      () => expect(optionOf(/Алина/)).not.toHaveAttribute("data-combobox-disabled"),
      SEARCH_TIMEOUT,
    );
    await user.click(optionOf(/Алина/) as HTMLElement);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("2"));
  });
});
