export interface EmailRecord {
  id: string;
  userId: string;
  messageId: string;
  threadId?: string;
  sender?: string;
  recipient?: string;
  subject?: string;
  snippet?: string;
  bodyText?: string;
  bodyHtml?: string;
  labels?: string[];
  receivedAt?: string;
  processed: boolean;
  createdAt: string;
}

export interface GmailSyncSummary {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
}
