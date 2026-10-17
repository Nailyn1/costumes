import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { PrivateRoute } from "src/app/providers/PrivateRoute";
import { useAuthStore } from "./auth.store";

const user = { login: "worker1", name: "Айгерим" };

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, isAuth: false });
  localStorage.clear();
});

describe("auth store", () => {
  it("setAuth stores the user and token and marks the session as authorized", () => {
    useAuthStore.getState().setAuth({ accessToken: "tok", user });

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "tok",
      user,
      isAuth: true,
    });
  });

  it("setAccessToken replaces only the token", () => {
    useAuthStore.getState().setAuth({ accessToken: "old", user });

    useAuthStore.getState().setAccessToken("new");

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "new",
      user,
      isAuth: true,
    });
  });

  it("logout clears the session and the persisted copy", () => {
    useAuthStore.getState().setAuth({ accessToken: "tok", user });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      user: null,
      isAuth: false,
    });
    const persisted = JSON.parse(
      localStorage.getItem("auth-storage") ?? "{}",
    ) as { state: { accessToken: string | null; isAuth: boolean } };
    expect(persisted.state).toMatchObject({ accessToken: null, isAuth: false });
  });
});

describe("PrivateRoute", () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>Страница входа</div>} />
          <Route element={<PrivateRoute />}>
            <Route path="/bookings/new" element={<div>Бронирование</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it("redirects an unauthorized user to /login", () => {
    renderAt("/bookings/new");

    expect(screen.getByText("Страница входа")).toBeInTheDocument();
  });

  it("renders the protected page for an authorized user", () => {
    useAuthStore.getState().setAuth({ accessToken: "tok", user });

    renderAt("/bookings/new");

    expect(screen.getByText("Бронирование")).toBeInTheDocument();
  });
});
