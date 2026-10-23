import {
  UpdateReservedVisitRequestSchema,
  type UpdateReservedVisitRequestDto,
} from "@costumes/shared";

function storageKey(userLogin: string, visitId: number): string {
  return `costumes.visit-edit.pending.v1.${encodeURIComponent(userLogin)}.${visitId}`;
}

export function getPendingVisitEditRequest(
  userLogin: string | null,
  visitId: number,
): UpdateReservedVisitRequestDto | null {
  if (!userLogin) return null;
  const key = storageKey(userLogin, visitId);
  try {
    const serialized = window.sessionStorage.getItem(key);
    if (!serialized) return null;
    const parsed: unknown = JSON.parse(serialized);
    const result = UpdateReservedVisitRequestSchema.safeParse(parsed);
    if (result.success) return result.data;
    window.sessionStorage.removeItem(key);
    return null;
  } catch {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Storage can be unavailable in browser privacy modes.
    }
    return null;
  }
}

export function savePendingVisitEditRequest(
  userLogin: string | null,
  visitId: number,
  request: UpdateReservedVisitRequestDto,
): boolean {
  if (!userLogin) return false;
  try {
    window.sessionStorage.setItem(storageKey(userLogin, visitId), JSON.stringify(request));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingVisitEditRequest(
  userLogin: string | null,
  visitId: number,
): void {
  if (!userLogin) return;
  try {
    window.sessionStorage.removeItem(storageKey(userLogin, visitId));
  } catch {
    // The in-memory state can still resolve the current session.
  }
}
