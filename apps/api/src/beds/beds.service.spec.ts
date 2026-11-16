import { BedsService } from './beds.service';
import { DatabaseService } from '../db/database.service';

describe('BedsService: límites de persistencia', () => {
  const query = jest.fn();
  const transaction = jest.fn();
  const service = new BedsService({ query, transaction } as unknown as DatabaseService);
  beforeEach(() => { query.mockReset(); transaction.mockReset(); });
  it('parametriza los filtros del censo', async () => {
    query.mockResolvedValue({ rows: [] });
    await service.list(); expect(query.mock.calls[0][1]).toEqual([null, null]);
    await service.list('OBSERVACION', 'AVAILABLE'); expect(query.mock.calls[1][1]).toEqual(['OBSERVACION', 'AVAILABLE']);
  });
  it.each([
    { code: '23505', constraint: 'one_active_patient_per_bed' },
    { code: '23505', constraint: 'one_active_bed_per_patient' },
    { code: '55P03' }, { code: '40P01' },
  ])('convierte la colisión/bloqueo de PostgreSQL en conflicto: %j', async error => {
    transaction.mockRejectedValue(error);
    await expect(service.assignment('UA-01', 'actor', null)).rejects.toMatchObject({ status: 409 });
  });
  it.each([{ code: '23505', constraint: 'other_constraint' }, new Error('fallo interno')])('no disfraza fallos internos como conflictos', async error => {
    transaction.mockRejectedValue(error);
    await expect(service.assignment('UA-01', 'actor', null)).rejects.toBe(error);
  });
});
