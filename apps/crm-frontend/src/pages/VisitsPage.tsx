import { VisitsList } from "src/features/visits/components/read/VisitsList";
import { Outlet } from "react-router-dom";

export function VisitsPage() {
  return (
    <>
      <VisitsList />
      <Outlet />
    </>
  );
}
