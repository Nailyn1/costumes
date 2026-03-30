import { useSearchVisits } from "../../hooks/useVisits";
import { BaseVisitSearchInput } from "../BaseVisitSearchInput";

interface IssueSearchInputProps {
  onSelectVisit: (visitId: number) => void;
}

export function IssueSearchInput({ onSelectVisit }: IssueSearchInputProps) {
  return (
    <BaseVisitSearchInput
      onSelectVisit={onSelectVisit}
      useSearchHook={useSearchVisits}
      placeholder="Выдача: поиск по коду, имени, костюму..."
    />
  );
}
