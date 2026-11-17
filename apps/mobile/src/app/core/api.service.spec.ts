import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { environment as debugEnvironment } from '../../environments/environment.android-debug';

import { API_BASE_URL, resolveApiUrl } from './api-config';
import { ApiService } from './api.service';
import { authInterceptor } from './auth.interceptor';
import { SessionService } from './session.service';

describe('Contrato HTTP y autorización', () => {
  let api: ApiService;
  let http: HttpTestingController;
  let session: SessionService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
      ],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    session.accept({
      role: 'ENFERMERO',
      access_token: `test.${btoa(JSON.stringify({ role: 'ENFERMERO', exp: Math.floor(Date.now() / 1000) + 900 }))}.test`,
    });
  });
  afterEach(() => {
    http.verify();
    session.clear();
  });
  it('envía la búsqueda por POST y documento en el cuerpo, con Bearer', () => {
    api.search('DEMO-001').subscribe();
    const request = http.expectOne('http://localhost:3000/api/patients/search');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ document: 'DEMO-001' });
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${session.token()}`);
    request.flush({});
  });
  it('no envía JWT al login ni a un destino externo', () => {
    api.login('sintetico@example.test', crypto.randomUUID()).subscribe();
    const login = http.expectOne('http://localhost:3000/api/auth/login');
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush({});
    TestBed.inject(HttpClient).get('https://external.test/api/beds').subscribe();
    const external = http.expectOne('https://external.test/api/beds');
    expect(external.request.headers.has('Authorization')).toBe(false);
    external.flush({});
  });
  it('respeta métodos, cuerpos y codificación de camas, panel y auditoría', () => {
    api
      .register({
        document: 'DEMO-001',
        fullName: 'Persona Sintética',
        triage: {
          chiefComplaint: 'Prueba',
          spo2: 98,
          glasgow: 15,
          eva: 1,
          paroInminente: false,
          dolorToracicoTipico: false,
        },
      })
      .subscribe();
    const registration = http.expectOne('http://localhost:3000/api/patients');
    expect(registration.request.method).toBe('POST');
    registration.flush({});
    api.assignBed('A/B', 'patient-id', 'OBSERVACION').subscribe();
    const assign = http.expectOne('http://localhost:3000/api/beds/A%2FB/assign');
    expect(assign.request.body).toEqual({ patientId: 'patient-id', service: 'OBSERVACION' });
    assign.flush({});
    api.bedAssignment('UA-01').subscribe();
    http.expectOne('http://localhost:3000/api/beds/UA-01/assignment').flush({});
    api.releaseBed('UA-01', 'reviewed-id').subscribe();
    const release = http.expectOne('http://localhost:3000/api/beds/UA-01/release');
    expect(release.request.body).toEqual({ assignmentId: 'reviewed-id' });
    release.flush({});
    api.completeCleaning('UA-01', 'version').subscribe();
    const cleaning = http.expectOne('http://localhost:3000/api/beds/UA-01/complete-cleaning');
    expect(cleaning.request.body).toEqual({ expectedUpdatedAt: 'version' });
    cleaning.flush({});
    api.panel().subscribe();
    http.expectOne('http://localhost:3000/api/triage/panel?page=1&limit=25').flush({});
    api.audit({ action: 'READ_AUDIT', cursor: '', limit: '25' }).subscribe();
    http.expectOne('http://localhost:3000/api/audit/events?action=READ_AUDIT&limit=25').flush({});
  });
  it('un 401 invalida la sesión y cancela otras solicitudes pendientes', () => {
    api.beds().subscribe({ error: () => undefined });
    api.search('DEMO-001').subscribe({ error: () => undefined });
    const beds = http.expectOne('http://localhost:3000/api/beds');
    const search = http.expectOne('http://localhost:3000/api/patients/search');
    beds.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.active()).toBe(false);
    expect(search.cancelled).toBe(true);
  });
  it('rechaza HTTP en producción y una URL nativa vacía', () => {
    const config = { production: true, browserApiUrl: '/api', nativeApiUrl: '' };
    expect(resolveApiUrl(config, false, 'https://sitcama.example')).toBe('https://sitcama.example/api');
    expect(resolveApiUrl(config, false, 'http://localhost:8100')).toBe('');
    expect(resolveApiUrl(config, true, 'https://localhost')).toBe('');
    expect(resolveApiUrl({ ...config, nativeApiUrl: 'http://10.0.2.2:3000/api' }, true, 'https://localhost')).toBe('');
  });
  it('permite HTTP solo para el destino exacto y con las dos condiciones debug', () => {
    expect(resolveApiUrl(debugEnvironment, true, 'https://localhost', true)).toBe('http://10.0.2.2:3000/api');
    expect(resolveApiUrl(debugEnvironment, true, 'https://localhost', false)).toBe('');
    expect(resolveApiUrl({ ...debugEnvironment, production: true }, true, 'https://localhost', true)).toBe('');
    expect(resolveApiUrl({ ...debugEnvironment, emulatorHttpDebug: false }, true, 'https://localhost', true)).toBe('');
    for (const nativeApiUrl of [
      'http://example.test:3000/api',
      'http://10.0.2.2:4000/api',
      'http://10.0.2.2:3000/other',
    ]) {
      expect(resolveApiUrl({ ...debugEnvironment, nativeApiUrl }, true, 'https://localhost', true)).toBe('');
    }
  });
});
