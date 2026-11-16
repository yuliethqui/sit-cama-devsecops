import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

const context = (request: unknown): ExecutionContext => ({
  switchToHttp: () => ({ getRequest: () => request }), getHandler: () => ({}), getClass: () => ({}),
}) as unknown as ExecutionContext;

describe('Guardas de acceso', () => {
  it.each([undefined, 'Basic abc', ['Bearer abc']])('exige encabezado Bearer válido', async authorization => {
    const guard = new JwtAuthGuard({} as JwtService);
    await expect(guard.canActivate(context({ headers: { authorization } }))).rejects.toMatchObject({ status: 401 });
  });

  it('rechaza tokens sin identidad o sin rol', async () => {
    for (const payload of [{ role: 'MEDICO' }, { sub: 'id' }]) {
      const guard = new JwtAuthGuard({ verifyAsync: jest.fn().mockResolvedValue(payload) } as unknown as JwtService);
      await expect(guard.canActivate(context({ headers: { authorization: 'Bearer abc' } }))).rejects.toMatchObject({ status: 401 });
    }
  });

  it('deniega rutas sin política y solicitudes sin rol', () => {
    const metadata = jest.fn().mockReturnValue(undefined);
    const guard = new RolesGuard({ getAllAndOverride: metadata } as unknown as Reflector);
    expect(guard.canActivate(context({}))).toBe(false);
    metadata.mockReturnValue(['MEDICO']);
    expect(() => guard.canActivate(context({}))).toThrow('Rol no autorizado');
  });
});
