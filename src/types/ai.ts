/**
 * LUMINA ADVANCED INTELLIGENCE CONTRACT
 * Governance for Gmail, Drive, and Smartsheet cross-pollination.
 */

export interface DriveDocument {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
}

export interface GmailTicket {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  relatedJobNumber?: string;
  isUnread: boolean;
  priority: 'urgent' | 'routine' | 'info';
}

export interface TriageResults {
  unreadRelevantEmails: GmailTicket[];
  stalledJobs: string[]; // Job numbers of projects that haven't moved
  attentionRequired: string; // Summary text
}

export type ToolType = 'GMAIL' | 'DRIVE' | 'SMARTSHEET' | 'ORACLE';

export interface LuminaContext {
  activeTool?: ToolType;
  lastAction?: string;
  isThinking: boolean;
}

export interface AISmartResponse {
  message: string;
  suggestedActions?: AIAction[];
  data?: any;
}

export interface AIAction {
  id: string;
  label: string;
  type: 'SMARTSHEET_REF' | 'GMAIL_LINK' | 'DRIVE_FOLDER';
  payload: any;
}
