import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router.tsx";
import { initSentry } from "./app/sentry.ts";
import { queryClient } from "./app/queryClient.ts";
// import "./index.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

initSentry();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="auto">
        <Notifications position="top-right" zIndex={1000} />
        <RouterProvider router={router} />
      </MantineProvider>

      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>
);
