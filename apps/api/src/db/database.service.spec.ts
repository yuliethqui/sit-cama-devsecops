import { DatabaseService } from './database.service';

jest.mock('pg', () => ({ Pool: jest.fn() }));
import { Pool } from 'pg';

describe('Transacciones y recursos PostgreSQL', () => {
  const query = jest.fn();
  const release = jest.fn();
  const pool = { query: jest.fn(), connect: jest.fn(), end: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks(); query.mockReset();
    pool.connect.mockResolvedValue({ query, release });
    (Pool as unknown as jest.Mock).mockImplementation(() => pool);
  });

  it('confirma y libera la conexión', async () => {
    const db = new DatabaseService();
    await expect(db.transaction(async () => 'ok')).resolves.toBe('ok');
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
    expect(release).toHaveBeenCalledTimes(1);
    await db.query('SELECT $1', [1]);
    expect(pool.query).toHaveBeenCalledWith('SELECT $1', [1]);
    await db.query('SELECT 1');
    await db.onModuleDestroy();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('revierte y libera ante un error del callback', async () => {
    const error = new Error('fallo');
    await expect(new DatabaseService().transaction(async () => { throw error; })).rejects.toBe(error);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('revierte ante fallo de COMMIT y libera incluso si falla ROLLBACK', async () => {
    query.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('commit')).mockRejectedValueOnce(new Error('rollback'));
    await expect(new DatabaseService().transaction(async () => 'ok')).rejects.toThrow('rollback');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
