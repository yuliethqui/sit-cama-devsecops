import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL, EMULATOR_API_URL } from './api-config';
import { authInterceptor } from './auth.interceptor';
import { emulatorHttpInterceptor, NATIVE_HTTP } from './emulator-http.interceptor';
import { NativeRuntimeService } from './native-runtime.service';
import { SessionService } from './session.service';

describe('Transporte nativo exclusivo del emulador debug', () => {
  const request = vi.fn();
  const runtime = { android: true, debuggable: true };
  beforeEach(() => {
    request.mockReset();
    runtime.android = true;
    runtime.debuggable = true;
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        provideHttpClient(withInterceptors([authInterceptor, emulatorHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: EMULATOR_API_URL },
        { provide: NativeRuntimeService, useValue: runtime },
        { provide: NATIVE_HTTP, useValue: { request } },
      ],
    });
  });
  afterEach(() => {
    TestBed.inject(SessionService).clear();
    TestBed.inject(HttpTestingController).verify();
  });
  it('envía login como JSON sin Bearer, sin caché y sin seguir redirecciones', async () => {
    request.mockResolvedValue({
      status: 200,
      headers: {},
      data: { role: 'ENFERMERO' },
      url: `${EMULATOR_API_URL}/auth/login`,
    });
    const input = { email: 'sintetico@emulator.test', password: crypto.randomUUID() };
    await firstValueFrom(TestBed.inject(HttpClient).post(`${EMULATOR_API_URL}/auth/login`, input));
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${EMULATOR_API_URL}/auth/login`,
        method: 'POST',
        data: input,
        disableRedirects: true,
        headers: expect.objectContaining({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }),
      }),
    );
    expect(request.mock.calls[0][0].headers['Authorization']).toBeUndefined();
  });
  it('conserva Bearer y convierte un error HTTP al contrato de Angular', async () => {
    const session = TestBed.inject(SessionService);
    session.accept({
      role: 'MEDICO',
      access_token: `test.${btoa(JSON.stringify({ role: 'MEDICO', exp: Math.floor(Date.now() / 1000) + 60 }))}.test`,
    });
    const token = session.token();
    request.mockResolvedValue({ status: 403, headers: {}, data: { message: 'Rol no autorizado' } });
    await expect(firstValueFrom(TestBed.inject(HttpClient).get(`${EMULATOR_API_URL}/beds`))).rejects.toMatchObject({
      status: 403,
    });
    expect(request.mock.calls[0][0].headers['Authorization']).toBe(`Bearer ${token}`);
  });
  it('no intercepta otros destinos ni un navegador normal', () => {
    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);
    http.get('https://external.test/').subscribe();
    controller.expectOne('https://external.test/').flush({});
    runtime.android = false;
    http.get(`${EMULATOR_API_URL}/beds`).subscribe();
    controller.expectOne(`${EMULATOR_API_URL}/beds`).flush([]);
    expect(request).not.toHaveBeenCalled();
  });
});
