export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  status?: string | null;
  url?: string | null;
  s3Key?: string | null;
  createdAt: Date | string;
}

export interface DocumentPanelProps {
  projectId: string;
  documents: Document[];
} 