export interface PanelItem {
  patientId: string;
  triageId: string;
  level: 'I' | 'II' | null;
  maxWaitMinutes: number | null;
  requiresClinicalReview: boolean;
  createdAt: string;
  elapsedMinutes: number;
  demoOnly: true;
}
export interface PanelResponse {
  items: PanelItem[];
  totals: { total: number; levelI: number; levelII: number; pending: number };
  page: number;
  limit: number;
  windowHours: number;
}
export interface AuditItem {
  id: string;
  recordedAt: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
}
export interface AuditResponse {
  items: AuditItem[];
  nextCursor: string | null;
  limit: number;
}
export const AUDIT_ACTIONS = [
  'REGISTER_PATIENT',
  'RECORD_TRIAGE',
  'SEARCH_PATIENT',
  'READ_TRIAGE',
  'ASSIGN_BED',
  'RELEASE_BED',
  'COMPLETE_CLEANING',
  'READ_BED_ASSIGNMENT',
  'READ_TRIAGE_PANEL',
  'READ_AUDIT',
];
export const AUDIT_ENTITIES = ['patient', 'triage', 'bed', 'panel', 'audit'];
