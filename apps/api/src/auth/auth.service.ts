import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { DatabaseService } from '../db/database.service';
import { QueryResultRow } from 'pg';
import { Role } from './roles.decorator';

interface UserRow extends QueryResultRow { id: string; email: string; role: Role; password_hash: string; active: boolean }

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService, private readonly jwt: JwtService) {}

  async login(email: string, password: string): Promise<{ access_token: string; role: Role }> {
    const result = await this.db.query<UserRow>(
      'SELECT id, email, role, password_hash, active FROM users WHERE email = $1 LIMIT 1',
      [email.toLowerCase()],
    );
    const user = result.rows[0];
    if (!user || !user.active || !(await argon2.verify(user.password_hash, password))) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    return { access_token: await this.jwt.signAsync({ sub: user.id, role: user.role }), role: user.role };
  }
}
