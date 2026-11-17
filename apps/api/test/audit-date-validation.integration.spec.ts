import { randomUUID } from 'node:crypto';
import { Inc08Harness } from './inc08-harness';

jest.setTimeout(20000);
describe('Auditoría: fechas y límites con PostgreSQL real', () => {
  const h = new Inc08Harness();
  beforeAll(() => h.start());
  afterAll(() => h.close());
  const path = (boundaries: Record<string, string>) => '/audit/events?' + new URLSearchParams({
    actorId: h.actors.COORDINADOR, action: 'SEARCH_PATIENT', entityType: 'patient', ...boundaries,
  }).toString();
  const reads = async () => Number((await h.sql.query(
    "SELECT count(*)::int AS n FROM audit_events WHERE actor_id=$1 AND action='READ_AUDIT'", [h.actors.AUDITOR],
  )).rows[0].n);

  it.each([
    ['idénticos', '2026-01-01T00:00:00.123456Z'],
    ['offset negativo', '2025-12-31T19:00:00.123456-05:00'],
    ['offset positivo', '2026-01-01T05:30:00.123456+05:30'],
  ])('incluye el instante exacto con extremos %s y excluye vecinos de 1 µs', async (_name, to) => {
    const at = '2026-01-01T00:00:00.123456Z';
    const ids: string[] = [];
    for (const value of ['2026-01-01T00:00:00.123455Z', at, '2026-01-01T00:00:00.123457Z']) {
      ids.push((await h.sql.query(`INSERT INTO audit_events(actor_id,entity_type,entity_id,action,recorded_at)
        VALUES($1,'patient',$2,'SEARCH_PATIENT',$3::timestamptz) RETURNING id::text`,
      [h.actors.COORDINADOR, randomUUID(), value])).rows[0].id);
    }
    const response = await h.request(path({ from: at, to }), 'GET', 'AUDITOR');
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { id: string }) => item.id)).toContain(ids[1]);
    expect(response.body.items.map((item: { id: string }) => item.id)).not.toContain(ids[0]);
    expect(response.body.items.map((item: { id: string }) => item.id)).not.toContain(ids[2]);
  });

  it.each([
    ['2026-01-01T00:00:00.123457Z', '2026-01-01T00:00:00.123456Z'],
    ['2026-01-01T05:30:00.123457+05:30', '2025-12-31T19:00:00.123456-05:00'],
    ['2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z'],
  ])('rechaza un rango invertido sin registrar lectura: %s > %s', async (from, to) => {
    const before = await reads();
    expect((await h.request(path({ from, to }), 'GET', 'AUDITOR')).status).toBe(400);
    expect(await reads()).toBe(before);
  });

  const validBoundaries: Record<string, string>[] = [
    { from: '0100-01-01T00:00:00.000000Z', to: '9999-12-31T23:59:59.999999Z' },
    { from: '1969-12-31T23:59:59.999999Z', to: '1970-01-01T00:00:00.000000Z' },
    { from: '2024-02-29T23:59:59.999999Z', to: '2024-03-01T00:00:00.000000Z' },
    { from: '2026-01-01T00:00:00.123456Z', to: '2026-01-01T00:00:00.123457Z' },
    { from: '2026-01-01T00:00:00.1Z', to: '2026-01-01T00:00:00.100000Z' },
    { from: '2026-01-01' },
    { to: '2026-01-01T00:00:00.999999Z' },
  ];
  it.each(validBoundaries)('acepta límites válidos: %j', async (boundaries) => {
    expect((await h.request(path(boundaries), 'GET', 'AUDITOR')).status).toBe(200);
  });

  it.each(['from', 'to'])('rechaza fechas inválidas en %s sin auditar una lectura', async (field) => {
    for (const value of ['', 'not-a-date', '2026-02-29T00:00:00Z', '2026-13-01T00:00:00Z',
      '2026-01-01T25:00:00Z', '2026-01-01T00:00:00+24:00', '0000-01-01T00:00:00Z']) {
      const before = await reads();
      expect((await h.request(path({ [field]: value }), 'GET', 'AUDITOR')).status).toBe(400);
      expect(await reads()).toBe(before);
    }
  });
});
