import { classifyTriage, TriageInput } from '../src/triage/triage.engine';

const healthy: TriageInput = { spo2: 98, glasgow: 15, eva: 1, paroInminente: false, dolorToracicoTipico: false };

describe('Incremento 08: fronteras académicas aún no cubiertas', () => {
  it.each([
    ['SpO2 mínimo admitido', { spo2: 0 }, 'I', 0],
    ['SpO2 máximo admitido', { spo2: 100 }, null, null],
    ['Glasgow mínimo admitido', { glasgow: 3 }, 'I', 0],
    ['inicio exacto de Glasgow II', { glasgow: 9 }, 'II', 30],
    ['fin exacto de Glasgow II', { glasgow: 13 }, 'II', 30],
    ['primer Glasgow posterior a II', { glasgow: 14 }, null, null],
    ['EVA mínimo admitido', { eva: 0 }, null, null],
    ['EVA inmediatamente anterior a II', { eva: 7 }, null, null],
    ['EVA máximo admitido', { eva: 10 }, 'II', 30],
    ['paro junto a criterios II', { paroInminente: true, glasgow: 13, eva: 10, dolorToracicoTipico: true }, 'I', 0],
    ['Glasgow I junto a dolor torácico', { glasgow: 8, dolorToracicoTipico: true }, 'I', 0],
  ] as const)('%s conserva prioridad, espera y revisión', (_name, change, level, wait) => {
    expect(classifyTriage({ ...healthy, ...change })).toEqual({
      level, maxWaitMinutes: wait, requiresClinicalReview: level === null, demoOnly: true,
    });
  });
});
