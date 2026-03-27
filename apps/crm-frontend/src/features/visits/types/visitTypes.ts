import type { OrdersNotWrittenResponseDto } from "@costumes/shared";
import type { ReactNode } from "react";

export interface VisitData {
  startDateTime: string | null;
  endDateTime: string | null;
  issueTimeFrom: string | undefined;
  issueTimeTo: string | undefined;
  returnTimeUntil: string | undefined;
}

export interface BookingFormValues extends VisitData {
  clientId: string | null;
  visitCode: string;
  notes: string;
  orders: VisitOrder[];
}

export interface VisitBlockProps {
  values: VisitData;
  onChange: <K extends keyof VisitData>(key: K, value: VisitData[K]) => void;
  errors?: Partial<Record<keyof VisitData, ReactNode>>;
}

export interface VisitDatePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (key: "startDateTime" | "endDateTime", value: Date | null) => void;
  error?: string;
}

export interface VisitTimePickerProps {
  issueFrom: string | null;
  issueTo: string | null;
  returnUntil: string | null;
  onChange: (
    key: "issueTimeFrom" | "issueTimeTo" | "returnTimeUntil",
    value: string,
  ) => void;
}

export interface VisitSelectorProps {
  values: VisitData;
  onChange: (values: VisitData) => void;
  errors?: Partial<Record<keyof VisitData, ReactNode>>;
}

export interface VisitOrder {
  childId: number | null;
  costumeId: number | null;
  rentPrice: number | undefined;
  prepaymentAmount: number | undefined;
  notes: string;
}

export interface CostumeDesktopAndMobileProps {
  items: OrdersNotWrittenResponseDto["items"];
}
