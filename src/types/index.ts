export type User = {
  id: string;
  username: string;
  created_at: string;
  is_admin: boolean;
};

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  invite_code: string;
  total_entries: number;
  created_at: string;
  file_path?: string;
  is_active?: boolean;
  labeling_type?: 'binary' | 'multi_class';
}

export type DatasetEntry = {
  id: string;
  dataset_id: string;
  text: string;
  score: number; // 1-5
};

export type DatasetLabel = {
  id: string;
  dataset_id: string;
  entry_id: string;
  user_id: string;
  label: 'positive' | 'negative' | 'neutral';
  created_at: string;
};

export type LabelProgress = {
  dataset_id: string;
  user_id: string;
  completed: number;
  total: number;
  start_date?: string;
  completed_date?: string;
  last_updated?: string;
  last_labeled_page?: number; // Add this field to track the last labeled page
};

export type LabelOption = 'positive' | 'negative' | 'neutral';