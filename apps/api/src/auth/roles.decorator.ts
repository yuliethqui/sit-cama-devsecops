import { SetMetadata } from '@nestjs/common';

export type Role = 'ENFERMERO' | 'MEDICO' | 'ADMISIONES' | 'COORDINADOR' | 'SERVICIOS' | 'AUDITOR';
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
