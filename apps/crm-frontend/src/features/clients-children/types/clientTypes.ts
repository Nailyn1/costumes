export interface SelectedChild {
  childId: number;
  name: string;
}
export interface SelectedClientData {
  id: string;
  name: string;
  phone: string;
  children?: SelectedChild[];
}

export interface ClientSearchFieldProps {
  value?: string | null;
  onSelect: (client: SelectedClientData | null) => void;
  error?: React.ReactNode;
}

export interface SelectedClientCardProps {
  client: SelectedClientData;
  onClearSelection: () => void;
  onUpdate: (updated: SelectedClientData) => void;
}

export interface ClientCreateFormProps {
  onCreated: (client: SelectedClientData) => void;
}

export interface ClientSelectorProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  error?: React.ReactNode;
}

export interface ClientUpdateFormProps {
  client: SelectedClientData;
  onSuccess: (updated: SelectedClientData) => void;
  onCancel: () => void;
}
