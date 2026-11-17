// Contracts inspected in apps/api/src/{auth,patients,beds}; search has no identity fields.
export const ROLES = ['ENFERMERO', 'MEDICO', 'ADMISIONES', 'COORDINADOR', 'SERVICIOS', 'AUDITOR'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_NAMES: Record<Role, string> = {
  ENFERMERO: 'Enfermería',
  MEDICO: 'Medicina',
  ADMISIONES: 'Admisiones',
  COORDINADOR: 'Coordinación',
  SERVICIOS: 'Servicios generales',
  AUDITOR: 'Auditoría',
};
export const REGISTER_ROLES: readonly Role[] = ['ENFERMERO', 'MEDICO'];
export const SEARCH_ROLES: readonly Role[] = ['ENFERMERO', 'MEDICO', 'ADMISIONES'];
export interface LoginResponse {
  access_token: string;
  role: Role;
}
export interface TriageInput {
  chiefComplaint: string;
  spo2: number;
  glasgow: number;
  eva: number;
  paroInminente: boolean;
  dolorToracicoTipico: boolean;
}
export interface RegisterPatientInput {
  document: string;
  fullName: string;
  triage: TriageInput;
}
export interface TriageSummary {
  id: string;
  level: 'I' | 'II' | 'III' | 'IV' | 'V' | null;
  maxWaitMinutes: number | null;
  requiresClinicalReview: boolean;
  createdAt: string;
  elapsedMinutes: number;
  demoOnly: true;
}
export interface RegistrationResponse {
  patientId: string;
  provisional: boolean;
  createdAt: string;
  triage: TriageSummary;
}
export interface PatientSearchResponse {
  patientId: string;
  provisional: boolean;
  createdAt: string;
  triageStatus: 'PENDING_TRIAGE' | 'PENDING_CLINICAL_REVIEW' | 'DEMO_CLASSIFIED';
  latestTriage: TriageSummary | null;
}
export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'BLOCKED';
export interface Bed {
  code: string;
  service: string;
  status: BedStatus;
  updated_at: string;
}
export interface BedAssignment {
  id: string;
  patientId: string;
  assignedAt: string;
}
export interface BedAssignmentView {
  bed: Bed;
  assignment: BedAssignment | null;
}
export interface BedAssigned {
  bed: Bed;
  assignment: BedAssignment;
  demoOnly: true;
}
export interface BedReleased {
  bed: Bed;
  assignmentId: string;
}
export const BED_STATES: { value: BedStatus; label: string; className: string }[] = [
  { value: 'AVAILABLE', label: 'Disponible', className: 'available' },
  { value: 'OCCUPIED', label: 'Ocupada', className: 'occupied' },
  { value: 'CLEANING', label: 'En limpieza', className: 'cleaning' },
  { value: 'BLOCKED', label: 'Bloqueada', className: 'blocked' },
];
export const SERVICE_NAMES: Record<string, string> = {
  URGENCIAS_ADULTOS: 'Urgencias adultos',
  URGENCIAS_PEDIATRICAS: 'Urgencias pediátricas',
  OBSERVACION: 'Observación',
  AISLAMIENTO: 'Aislamiento',
};
export function serviceName(service: string): string {
  return SERVICE_NAMES[service] ?? service;
}
export function statusName(status: BedStatus): string {
  return BED_STATES.find((s) => s.value === status)?.label ?? status;
}
