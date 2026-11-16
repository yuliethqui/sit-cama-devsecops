/**
 * Reglas sintéticas de DEMOSTRACIÓN tomadas de los criterios HU-01.
 * NO representa un algoritmo clínico completo de la Resolución 5596/2015.
 * No activa clasificación automatizada para III-V sin aprobación clínica.
 */
export interface TriageInput {
  spo2: number;
  glasgow: number;
  eva: number;
  paroInminente: boolean;
  dolorToracicoTipico: boolean;
}
export type TriageLevel = 'I' | 'II';
export type TriageAssessment =
  | { level: TriageLevel; maxWaitMinutes: number; requiresClinicalReview: false; demoOnly: true }
  | { level: null; maxWaitMinutes: null; requiresClinicalReview: true; demoOnly: true };

export function classifyTriage(input: TriageInput): TriageAssessment {
  if (input.paroInminente || input.spo2 < 85 || input.glasgow < 9) {
    return { level: 'I', maxWaitMinutes: 0, requiresClinicalReview: false, demoOnly: true };
  }
  if ((input.glasgow >= 9 && input.glasgow <= 13) || input.eva >= 8 || input.dolorToracicoTipico) {
    return { level: 'II', maxWaitMinutes: 30, requiresClinicalReview: false, demoOnly: true };
  }
  return { level: null, maxWaitMinutes: null, requiresClinicalReview: true, demoOnly: true };
}
