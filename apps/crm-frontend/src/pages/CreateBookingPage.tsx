import { CreateBookingForm } from "src/features/visits/components/CreateBookingForm";
import { useAuthStore } from "src/stores/auth.store";

export function CreateBookingPage() {
  const userLogin = useAuthStore((state) => state.user?.login ?? null);
  return <CreateBookingForm key={userLogin ?? "anonymous"} />;
}
