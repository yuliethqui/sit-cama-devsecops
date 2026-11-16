import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';
import { Role } from '../auth/roles.decorator';

@Injectable()
export class AccessService {
  constructor(private readonly jwt: JwtService, private readonly db: DatabaseService) {}

  async requireRole(id: string, role: Role, client?: PoolClient): Promise<void> {
    const text = 'SELECT id FROM users WHERE id=$1 AND active=true AND role=$2';
    const result = client ? await client.query(text, [id, role]) : await this.db.query(text, [id, role]);
    if (!result.rows.length) throw new ForbiddenException();
  }

  async socketToken(token: unknown) {
    if (typeof token !== 'string' || token.length > 4096) throw new ForbiddenException();
    const payload = await this.jwt.verifyAsync(token, {
      algorithms: ['HS256'], issuer: 'sit-cama-api', audience: 'sit-cama-client',
    });
    if (!isUUID(payload.sub, '4') || payload.role !== 'MEDICO' ||
      !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) throw new ForbiddenException();
    await this.requireRole(payload.sub, 'MEDICO');
    return { id: payload.sub as string, expires: payload.exp * 1000 as number };
  }
}
