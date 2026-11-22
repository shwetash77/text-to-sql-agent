export type Row = Record<string, unknown>;

export interface AskResponse {
  id: string;
  question: string;
  answer: string;
  sql: string | null;
  rows: Row[];
}

export interface HistoryItem {
  id: string;
  question: string;
  answer: string;
  sql: string | null;
  rowCount: number;
  createdAt: string;
}
