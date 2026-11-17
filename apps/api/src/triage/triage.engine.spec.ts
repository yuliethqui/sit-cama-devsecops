import { classifyTriage, TriageInput } from './triage.engine';
const healthy: TriageInput = { spo2: 98, glasgow: 15, eva: 1, paroInminente: false, dolorToracicoTipico: false };

describe('HU-01: reglas de triaje de DEMOSTRACIÓN', () => {
  it('clasifica I cuando SpO2 < 85', () => expect(classifyTriage({ ...healthy, spo2: 84 }).level).toBe('I'));
  it('clasifica I cuando Glasgow < 9', () => expect(classifyTriage({ ...healthy, glasgow: 8 }).level).toBe('I'));
  it('clasifica I con paro inminente', () => expect(classifyTriage({ ...healthy, paroInminente: true }).level).toBe('I'));
  it('prioriza I sobre II', () => expect(classifyTriage({ ...healthy, spo2: 84, eva: 9 }).level).toBe('I'));
  it('clasifica II con Glasgow 9 a 13', () => expect(classifyTriage({ ...healthy, glasgow: 12 }).level).toBe('II'));
  it('clasifica II con EVA 8', () => expect(classifyTriage({ ...healthy, eva: 8 }).level).toBe('II'));
  it('clasifica II con dolor torácico típico', () => expect(classifyTriage({ ...healthy, dolorToracicoTipico: true }).level).toBe('II'));
  it('no inventa una clasificación III-V sin reglas aprobadas', () => expect(classifyTriage(healthy)).toMatchObject({ level: null, requiresClinicalReview: true }));
  it('respeta el límite 85 (no es I por saturación)', () => expect(classifyTriage({ ...healthy, spo2: 85 }).level).toBeNull());
  it('devuelve 0 minutos para I y 30 para II', () => {
    expect(classifyTriage({ ...healthy, spo2: 50 }).maxWaitMinutes).toBe(0);
    expect(classifyTriage({ ...healthy, eva: 9 }).maxWaitMinutes).toBe(30);
  });
});
