export interface SelectedCostumeData {
  costumeId: number;
  name: string;
  inventoryCode?: string;
}

export interface CostumeSearchAvailableFieldProps {
  value?: string | null;
  onSelect: (client: SelectedCostumeData | null) => void;
  error?: React.ReactNode;
  startDateTime: Date | string | null;
  endDateTime: Date | string | null;
  issueTimeFrom: string;
  returnTimeUntil: string;
}

export interface SelectedCostumeCardProps {
  costume: SelectedCostumeData;
  onClearSelection: () => void;
  onUpdate: (updated: SelectedCostumeData) => void;
}

export interface CostumeCreateFormProps {
  onCreated: (costume: SelectedCostumeData) => void;
  buttonText?: string;
}

export interface CostumeSelectorProps {
  value?: string | null;
  onChange: (id: number | null) => void;
  error?: React.ReactNode;
  startDateTime: Date | string | null;
  endDateTime: Date | string | null;
  issueTimeFrom: string;
  returnTimeUntil: string;
}

export interface CostuneUpdateFormProps {
  client: SelectedCostumeData;
  onSuccess: (updated: SelectedCostumeData) => void;
  onCancel: () => void;
}
