import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<Role[]>('roles', [context.getHandler(), context.getClass()]);
    if (!allowed) return false; // Fail closed: una ruta sin política explícita no está autorizada.
    const role = context.switchToHttp().getRequest().user?.role as Role | undefined;
    if (!role || !allowed.includes(role)) throw new ForbiddenException('Rol no autorizado');
    return true;
  }
}
