import { AxiosError } from "axios";
import * as Sentry from "@sentry/react";

type HandleErrorOptions = {
  title: string;
  fallbackMessage?: string;
  silentStatuses?: number[];
};

export function handleError(
  error: unknown,
  options: HandleErrorOptions
): string | null {
  const {
    title,
    fallbackMessage = "Unexpected error",
    silentStatuses = [],
  } = options;

  if (import.meta.env.DEV) {
    console.error(`[${title}]:`, error);
  }

  if (error instanceof AxiosError) {
    const status = error.response?.status;

    if (status && silentStatuses.includes(status)) {
      return null;
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;

    Sentry.captureException(error, {
      extra: { title, serverResponse: error.response?.data },
      tags: { component: title },
    });

    return message ?? fallbackMessage;
  }

  if (error instanceof Error) {
    Sentry.captureException(error, { extra: { title } });
    return error.message;
  }

  Sentry.captureException(error, { extra: { title, originalError: error } });
  return fallbackMessage;
}
