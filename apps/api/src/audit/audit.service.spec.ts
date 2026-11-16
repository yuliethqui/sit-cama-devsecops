import { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';
import { AccessService } from '../realtime/access.service';
import { AuditService } from './audit.service';
import { PanelService } from '../panel/panel.service';

describe('Lecturas auditadas transaccionales', () => {
  const query = jest.fn();
  const client = { query } as unknown as PoolClient;
  const db = { transaction: (fn: (c: PoolClient) => unknown) => fn(client) } as unknown as DatabaseService;
  const requireRole = jest.fn();
  const access = { requireRole } as unknown as AccessService;
  beforeEach(() => {
    requireRole.mockReset().mockResolvedValue(undefined);
    query.mockReset().mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO audit_events')) throw new Error('audit unavailable');
      return { rows: [] };
    });
  });
  it('no devuelve auditoría si no puede registrar el acceso', async () => {
    await expect(new AuditService(db, access).list({ limit: 25 }, 'actor', null)).rejects.toThrow('audit unavailable');
  });
  it('no devuelve panel si falla la auditoría', async () => {
    await expect(new PanelService(db, access).list({ page: 1, limit: 25 }, 'actor', null)).rejects.toThrow('audit unavailable');
  });
  it('rechaza acceso revocado antes de consultar los eventos', async () => {
    requireRole.mockRejectedValue(new Error('revoked'));
    await expect(new AuditService(db, access).list({ limit: 25 }, 'actor', null)).rejects.toThrow('revoked');
    expect(query).not.toHaveBeenCalled();
  });
});
