import { useSearchIssuedVisits } from "../../hooks/useVisits";
import { BaseVisitSearchInput } from "../BaseVisitSearchInput";

interface ReturnSearchInputProps {
  onSelectVisit: (visitId: number) => void;
}

export function ReturnSearchInput({ onSelectVisit }: ReturnSearchInputProps) {
  return (
    <BaseVisitSearchInput
      onSelectVisit={onSelectVisit}
      useSearchHook={useSearchIssuedVisits}
      placeholder="Возврат: поиск по коду, имени, костюму..."
    />
  );
}
