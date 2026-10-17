import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

/** QueryClient для тестов: без ретраев и без кэша между тестами. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <Notifications />
          <MemoryRouter>{children}</MemoryRouter>
        </MantineProvider>
      </QueryClientProvider>
    );
  };
}

/** render() с провайдерами приложения: React Query, Mantine, Router. */
export function renderWithProviders(
  ui: ReactElement,
  queryClient = createTestQueryClient(),
) {
  return {
    queryClient,
    ...render(ui, { wrapper: createWrapper(queryClient) }),
  };
}

/** renderHook() с теми же провайдерами — для React Query хуков. */
export function renderHookWithProviders<T>(
  hook: () => T,
  queryClient = createTestQueryClient(),
) {
  return {
    queryClient,
    ...renderHook(hook, { wrapper: createWrapper(queryClient) }),
  };
}
