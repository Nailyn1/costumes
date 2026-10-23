import { TypedStatusError } from "@costumes/shared";

function getStatus(error: unknown): number | null {
  if (error instanceof TypedStatusError) return error.response.status;
  if (typeof error !== "object" || error === null || !("response" in error)) return null;
  const response = error.response;
  if (
    typeof response !== "object" ||
    response === null ||
    !("status" in response) ||
    typeof response.status !== "number"
  ) return null;
  return response.status;
}

function getCode(error: unknown): string | null {
  const data = getResponseData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) return null;
  return typeof data.code === "string" ? data.code : null;
}

function getResponseData(error: unknown): unknown {
  return error instanceof TypedStatusError
    ? error.response.data
    : typeof error === "object" && error !== null && "response" in error
      ? (error.response as { data?: unknown } | undefined)?.data
      : undefined;
}

export function isStaleVisitVersionConflict(error: unknown): boolean {
  return getStatus(error) === 409 && getCode(error) === "VISIT_VERSION_CONFLICT";
}

/** Unknown results stay frozen so retries resend the identical body and command id. */
export function isAmbiguousAddIssuedFailure(error: unknown): boolean {
  if (isStaleVisitVersionConflict(error)) return false;
  const status = getStatus(error);
  if (status === 409 || status === null || [401, 408, 429].includes(status)) return true;
  return status >= 500;
}
