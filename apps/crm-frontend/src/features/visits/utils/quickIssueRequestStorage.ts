import {
  QuickIssueVisitRequestSchema,
  type QuickIssueVisitRequestDto,
} from "@costumes/shared";

function storageKey(userLogin: string): string {
  return `costumes.quick-issue.pending.v1.${encodeURIComponent(userLogin)}`;
}

export function getPendingQuickIssueRequest(
  userLogin: string | null,
): QuickIssueVisitRequestDto | null {
  if (!userLogin) return null;

  try {
    const key = storageKey(userLogin);
    const serialized = window.sessionStorage.getItem(key);
    if (!serialized) return null;
    const parsed: unknown = JSON.parse(serialized);
    const result = QuickIssueVisitRequestSchema.safeParse(parsed);
    if (result.success) return result.data;
    window.sessionStorage.removeItem(key);
    return null;
  } catch {
    try {
      window.sessionStorage.removeItem(storageKey(userLogin));
    } catch {
      // Storage may be unavailable; ignore the corrupt or unreadable value.
    }
    return null;
  }
}

export function savePendingQuickIssueRequest(
  userLogin: string | null,
  request: QuickIssueVisitRequestDto,
): boolean {
  if (!userLogin) return false;
  try {
    window.sessionStorage.setItem(storageKey(userLogin), JSON.stringify(request));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingQuickIssueRequest(userLogin: string | null): void {
  if (!userLogin) return;
  try {
    window.sessionStorage.removeItem(storageKey(userLogin));
  } catch {
    // Storage may be unavailable in browser privacy modes; in-memory state still resolves this session.
  }
}
