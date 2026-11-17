import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { ApiConfigurationError, apiErrorMessage } from './api.service';

describe('Errores públicos sin detalles sensibles del servidor', () => {
  it.each([
    [0, 'login', 'conexión'],
    [400, 'register', 'campos'],
    [401, 'login', 'incorrectos'],
    [401, 'beds', 'sesión'],
    [403, 'audit', 'permiso'],
    [404, 'search', 'exacto'],
    [404, 'beds', 'recurso'],
    [409, 'assign', 'triaje'],
    [409, 'release', 'ocupación'],
    [409, 'cleaning', 'limpieza'],
    [409, 'register', 'documento'],
    [409, 'beds', 'estado'],
    [503, 'search', 'no está disponible'],
    [500, 'panel', 'servidor'],
  ] as const)('sanitiza HTTP %s en %s', (status, context, expected) => {
    const text = apiErrorMessage(new HttpErrorResponse({ status, error: { secret: 'must-not-leak' } }), context);
    expect(text.toLowerCase()).toContain(expected);
    expect(text).not.toContain('must-not-leak');
  });
  it('distingue timeout, configuración insegura y fallos desconocidos', () => {
    expect(apiErrorMessage(new TimeoutError(), 'login')).toContain('tardó');
    expect(apiErrorMessage(new ApiConfigurationError(), 'login')).toContain('segura');
    expect(apiErrorMessage(new Error('private'), 'login')).not.toContain('private');
  });
});
