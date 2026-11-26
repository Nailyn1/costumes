import {
  AddAndIssueVisitRequestSchema,
  type AddAndIssueVisitRequestDto,
} from "@costumes/shared";

function storageKey(userLogin: string, visitId: number): string {
  return `costumes.add-issued.pending.v1.${encodeURIComponent(userLogin)}.${visitId}`;
}

export function getPendingAddIssuedRequest(
  userLogin: string | null,
  visitId: number,
): AddAndIssueVisitRequestDto | null {
  if (!userLogin) return null;
  const key = storageKey(userLogin, visitId);
  try {
    const serialized = window.sessionStorage.getItem(key);
    if (!serialized) return null;
    const parsed: unknown = JSON.parse(serialized);
    const result = AddAndIssueVisitRequestSchema.safeParse(parsed);
    if (result.success) return result.data;
    window.sessionStorage.removeItem(key);
    return null;
  } catch {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // The in-memory request can still be retried during this session.
    }
    return null;
  }
}

export function savePendingAddIssuedRequest(
  userLogin: string | null,
  visitId: number,
  request: AddAndIssueVisitRequestDto,
): boolean {
  if (!userLogin) return false;
  try {
    window.sessionStorage.setItem(storageKey(userLogin, visitId), JSON.stringify(request));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingAddIssuedRequest(
  userLogin: string | null,
  visitId: number,
): void {
  if (!userLogin) return;
  try {
    window.sessionStorage.removeItem(storageKey(userLogin, visitId));
  } catch {
    // The in-memory result can still resolve this session.
  }
}
