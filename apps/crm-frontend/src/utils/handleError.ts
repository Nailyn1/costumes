import { AxiosError } from "axios";
import * as Sentry from "@sentry/react";
import { TypedStatusError } from "@costumes/shared";
import { ZodError } from "zod";

type HandleErrorOptions = {
  title: string;
  fallbackMessage?: string;
  silentStatuses?: number[];
};

type ApiErrorBody = {
  statusCode: number;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const CONTRACT_ERROR_MESSAGE = "Ошибка обработки данных. Повторите действие или обратитесь к администратору";
const NETWORK_ERROR_MESSAGE = "Нет соединения с сервером. Проверьте подключение и повторите действие";
const DEFAULT_ERROR_MESSAGE = "Не удалось выполнить действие. Повторите попытку";

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.statusCode === "number" && typeof body.message === "string";
}

function safeMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const message = value.trim();
  // Старый сервер может прислать диагностический текст вместо сообщения сотруднику.
  return message.length > 0 && message.length <= 300 && /[А-Яа-яЁё]/u.test(message) &&
    !["{", "}", "[", "]", "\\"].some((character) => message.includes(character))
    ? message
    : null;
}

function errorResponse(error: unknown): { status: number; data: unknown } | null {
  if (error instanceof TypedStatusError) {
    return { status: error.response.status, data: error.response.data };
  }
  if (error instanceof AxiosError && error.response) {
    return { status: error.response.status, data: error.response.data };
  }
  return null;
}

export function getApiFieldErrors(error: unknown): Record<string, string[]> | null {
  const response = errorResponse(error);
  if (!response || !isApiErrorBody(response.data) || response.data.statusCode !== response.status) {
    return null;
  }
  const fields = response.data.fieldErrors;
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) return null;
  const result: Record<string, string[]> = {};
  for (const [name, messages] of Object.entries(fields)) {
    if (!Array.isArray(messages)) continue;
    const safe = messages.map(safeMessage).filter((message): message is string => message !== null);
    if (safe.length) result[name] = safe;
  }
  return Object.keys(result).length ? result : null;
}

export function applyApiFieldErrors(
  error: unknown,
  fields: readonly string[],
  setFieldError: (field: string, message: string) => void,
): void {
  const errors = getApiFieldErrors(error);
  if (!errors) return;
  for (const field of fields) {
    const message = errors[field]?.[0];
    if (message) setFieldError(field, message);
  }
}

export function handleError(error: unknown, options: HandleErrorOptions): string | null {
  const { title, fallbackMessage = DEFAULT_ERROR_MESSAGE, silentStatuses = [] } = options;
  const response = errorResponse(error);

  if (response && silentStatuses.includes(response.status)) return null;

  if (import.meta.env.DEV) console.error(`[${title}]:`, error);
  Sentry.captureException(error, { extra: { title }, tags: { component: title } });

  if (error instanceof ZodError) return CONTRACT_ERROR_MESSAGE;
  if (response) {
    if (isApiErrorBody(response.data) && response.data.statusCode === response.status) {
      return safeMessage(response.data.message) ?? fallbackMessage;
    }
    return fallbackMessage;
  }
  if (error instanceof AxiosError || error instanceof TypeError) return NETWORK_ERROR_MESSAGE;
  return fallbackMessage;
}
