import { TypedStatusError } from "@costumes/shared";

function errorResponse(error: unknown): { status: number; data?: unknown } | null {
  if (error instanceof TypedStatusError) {
    return { status: error.response.status, data: error.response.data };
  }
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return null;
  }
  const response = error.response;
  if (
    typeof response !== "object" ||
    response === null ||
    !("status" in response) ||
    typeof response.status !== "number"
  ) {
    return null;
  }
  return {
    status: response.status,
    data: "data" in response ? response.data : undefined,
  };
}

function errorCode(error: unknown): string | null {
  const data = errorResponse(error)?.data;
  if (typeof data !== "object" || data === null || !("code" in data)) return null;
  return typeof data.code === "string" ? data.code : null;
}

export function isVisitVersionConflict(error: unknown): boolean {
  return errorResponse(error)?.status === 409 && errorCode(error) === "VISIT_VERSION_CONFLICT";
}

export function isAmbiguousVisitEditFailure(error: unknown): boolean {
  const status = errorResponse(error)?.status;
  if (status === 409) return !isVisitVersionConflict(error);
  return status === undefined || status === null || [401, 408, 425, 429].includes(status) || status >= 500;
}

export function visitEditFailureMessage(error: unknown): string {
  const response = errorResponse(error);
  const data = response?.data;
  if (typeof data === "object" && data !== null && "message" in data) {
    const message = data.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message) && message.every((item) => typeof item === "string")) {
      return message.join("; ");
    }
  }
  if (isVisitVersionConflict(error)) {
    return "Визит изменил другой сотрудник. Обновите данные перед повторным сохранением.";
  }
  if (isAmbiguousVisitEditFailure(error)) {
    return "Результат сохранения пока неизвестен. Повторите отправку этой же команды.";
  }
  return "Не удалось сохранить изменения. Проверьте данные и повторите попытку.";
}
