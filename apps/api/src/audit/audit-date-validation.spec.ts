import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';
import { AccessService } from '../realtime/access.service';
import { AuditService } from './audit.service';
import { AuditQuery } from './audit.dto';

describe('AuditService: validación temporal sin pérdida de microsegundos', () => {
  it('rechaza el intervalo invertido por 1 µs antes de leer eventos o auditar una lectura', async () => {
    const from = '2026-01-01T00:00:00.123457Z';
    const to = '2026-01-01T00:00:00.123456Z';
    expect(Date.parse(from)).toBe(Date.parse(to));
    const query = jest.fn(async (sql: string) => ({
      // PostgreSQL compares these two instants at microsecond resolution.
      rows: sql.includes('::timestamptz') ? [{ ordered: false }] : [],
    }));
    const client = { query } as unknown as PoolClient;
    const db = { transaction: (operation: (connection: PoolClient) => unknown) => operation(client) } as unknown as DatabaseService;
    const access = { requireRole: jest.fn().mockResolvedValue(undefined) } as unknown as AccessService;

    await expect(new AuditService(db, access).list({ from, to, limit: 25 }, 'actor', null))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('::timestamptz'), [from, to]);
  });

  function fixture(ordered: boolean | null = true) {
    const query = jest.fn().mockImplementation(async (sql: string) => ({
      rows: sql.includes('::timestamptz') ? [{ ordered }] : [],
    }));
    const client = { query } as unknown as PoolClient;
    const transaction = jest.fn(async (operation: (connection: PoolClient) => unknown) => operation(client));
    const requireRole = jest.fn().mockResolvedValue(undefined);
    const service = new AuditService({ transaction } as unknown as DatabaseService,
      { requireRole } as unknown as AccessService);
    return { service, query, transaction, requireRole };
  }

  it.each([
    ['fechas iguales con seis decimales', '2026-01-01T00:00:00.123456Z', '2026-01-01T00:00:00.123456Z'],
    ['precisiones equivalentes', '2026-01-01T00:00:00.1Z', '2026-01-01T00:00:00.100000Z'],
    ['offset negativo equivalente', '2026-01-01T00:00:00.123456Z', '2025-12-31T19:00:00.123456-05:00'],
    ['offset positivo equivalente', '2026-01-01T00:00:00.123456Z', '2026-01-01T05:30:00.123456+05:30'],
    ['intervalo válido de un microsegundo', '2026-01-01T00:00:00.123456Z', '2026-01-01T00:00:00.123457Z'],
    ['cruce del epoch', '1969-12-31T23:59:59.999999Z', '1970-01-01T00:00:00.000000Z'],
    ['día bisiesto y cambio de día', '2024-02-29T23:59:59.999999Z', '2024-03-01T00:00:00.000000Z'],
    ['años remotos admitidos por el DTO', '0100-01-01T00:00:00.000000Z', '9999-12-31T23:59:59.999999Z'],
    ['fechas sin hora ya admitidas por el DTO', '2026-01-01', '2026-01-02'],
    ['horas sin zona ya admitidas por el DTO', '2026-01-01T00:00:00.123456', '2026-01-01T00:00:00.123457'],
  ])('conserva los parámetros originales: %s', async (_name, from, to) => {
    expect(validateSync(Object.assign(new AuditQuery(), { from, to }))).toEqual([]);
    const { service, query, requireRole } = fixture();
    await expect(service.list({ from, to, limit: 25 }, 'actor', null))
      .resolves.toEqual({ items: [], nextCursor: null, limit: 25 });
    expect(requireRole).toHaveBeenCalledWith('actor', 'AUDITOR', expect.anything());
    expect(query.mock.calls[0][1]).toEqual([from, to]);
    expect(query.mock.calls[1][0]).toContain('recorded_at >= $1 AND recorded_at <= $2');
    expect(query.mock.calls[1][0]).toContain('ORDER BY audit_events.id DESC');
    expect(query.mock.calls[1][1]).toEqual([from, to, 26]);
    expect(query.mock.calls[2][0]).toContain('INSERT INTO audit_events');
  });

  it.each([
    { from: '2026-01-01T00:00:00.000001Z' },
    { to: '2026-01-01T00:00:00.999999Z' },
  ])('valida un único extremo sin introducir otro límite: %j', async (boundary) => {
    const { service, query } = fixture(null);
    await expect(service.list({ ...boundary, limit: 25 }, 'actor', null)).resolves.toHaveProperty('items', []);
    expect(query.mock.calls[0][1]).toEqual([boundary.from ?? null, boundary.to ?? null]);
    expect(query.mock.calls[1][1]).toEqual([boundary.from ?? boundary.to, 26]);
  });

  it('no añade consultas de fechas cuando no se filtra por fechas', async () => {
    const { service, query } = fixture();
    await service.list({ limit: 25 }, 'actor', null);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('FROM audit_events');
  });

  it('comprueba el permiso vigente antes de consultar o comparar fechas', async () => {
    const { service, query, requireRole } = fixture();
    requireRole.mockRejectedValue(new Error('revoked'));
    await expect(service.list({ from: '2026-01-01', to: '2026-01-02', limit: 25 }, 'actor', null))
      .rejects.toThrow('revoked');
    expect(query).not.toHaveBeenCalled();
  });

  it.each(['22007', '22008', '22009'])('devuelve 400 sin leer eventos ni exponer el error PostgreSQL %s', async (code) => {
    const { service, query } = fixture();
    query.mockRejectedValueOnce(Object.assign(new Error('database detail must stay private'), { code }));
    await expect(service.list({ from: '0000-01-01', limit: 25 }, 'actor', null))
      .rejects.toMatchObject({ status: 400, message: 'Bad Request' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([new Error('database unavailable'), null])('conserva los errores ajenos a fechas: %s', async (error) => {
    const { service, query } = fixture();
    query.mockRejectedValueOnce(error);
    await expect(service.list({ to: '2026-01-01', limit: 25 }, 'actor', null)).rejects.toBe(error);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each(['from', 'to'])('el DTO sigue rechazando entradas inválidas en %s', (field) => {
    for (const value of ['', 'not-a-date', 'infinity', '0001-01-01T00:00:00Z', '2026-02-29T00:00:00Z',
      '2026-13-01T00:00:00Z', '2026-01-01T25:00:00Z', '2026-01-01T00:00:00+24:00',
      '2026-01-01; SELECT 1', ['2026-01-01'], 123]) {
      expect(validateSync(Object.assign(new AuditQuery(), { [field]: value })).map(error => error.property))
        .toContain(field);
    }
  });

  it('conserva el rechazo del cursor fuera de int64 antes de iniciar una transacción', async () => {
    const { service, transaction } = fixture();
    await expect(service.list({ cursor: '9223372036854775808', limit: 25 }, 'actor', null))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
