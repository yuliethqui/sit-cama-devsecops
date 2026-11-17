import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from './roles.decorator';

export interface AuthenticatedUser { id: string; role: Role; }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: unknown = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) throw new UnauthorizedException('Token requerido');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: Role }>(header.slice(7), {
        algorithms: ['HS256'], issuer: 'sit-cama-api', audience: 'sit-cama-client',
      });
      if (!payload.sub || !payload.role) throw new Error('Token sin identidad');
      request.user = { id: payload.sub, role: payload.role } as AuthenticatedUser;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
