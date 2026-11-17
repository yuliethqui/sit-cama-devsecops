import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { defer, throwError, TimeoutError } from 'rxjs';

import { API_BASE_URL } from './api-config';
import type {
  Bed,
  BedAssigned,
  BedAssignmentView,
  BedReleased,
  LoginResponse,
  PatientSearchResponse,
  RegistrationResponse,
  RegisterPatientInput,
} from './contracts';
import type { PanelResponse, AuditResponse } from './panel-contracts';

export class ApiConfigurationError extends Error {}
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private request<T>(path: string, body?: unknown): Observable<T> {
    return defer(() => {
      if (!this.base) return throwError(() => new ApiConfigurationError());
      return body === undefined
        ? this.http.get<T>(`${this.base}${path}`)
        : this.http.post<T>(`${this.base}${path}`, body);
    });
  }
  login(email: string, password: string): Observable<LoginResponse> {
    return this.request('/auth/login', { email, password });
  }
  register(input: RegisterPatientInput): Observable<RegistrationResponse> {
    return this.request('/patients', input);
  }
  search(document: string): Observable<PatientSearchResponse> {
    return this.request('/patients/search', { document });
  }
  beds(): Observable<Bed[]> {
    return this.request('/beds');
  }
  panel(page = 1): Observable<PanelResponse> {
    return this.request(`/triage/panel?page=${page}&limit=25`);
  }
  audit(filters: Record<string, string>): Observable<AuditResponse> {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => !!value));
    return this.request(`/audit/events?${params.toString()}`);
  }
  assignBed(code: string, patientId: string, service: string): Observable<BedAssigned> {
    return this.request(`/beds/${encodeURIComponent(code)}/assign`, { patientId, service });
  }
  bedAssignment(code: string): Observable<BedAssignmentView> {
    return this.request(`/beds/${encodeURIComponent(code)}/assignment`);
  }
  releaseBed(code: string, assignmentId: string): Observable<BedReleased> {
    return this.request(`/beds/${encodeURIComponent(code)}/release`, { assignmentId });
  }
  completeCleaning(code: string, expectedUpdatedAt: string): Observable<Bed> {
    return this.request(`/beds/${encodeURIComponent(code)}/complete-cleaning`, { expectedUpdatedAt });
  }
}
export function apiErrorMessage(
  error: unknown,
  context: 'login' | 'register' | 'search' | 'beds' | 'assign' | 'release' | 'cleaning' | 'panel' | 'audit',
): string {
  if (error instanceof TimeoutError) return 'La solicitud tardó demasiado. Vuelve a intentarlo.';
  if (error instanceof ApiConfigurationError)
    return 'La conexión segura no está configurada. Contacta con la administración.';
  if (!(error instanceof HttpErrorResponse)) return 'No fue posible completar la solicitud. Inténtalo de nuevo.';
  switch (error.status) {
    case 0:
      return 'No hay conexión con la API. Comprueba la red y que el servidor esté disponible.';
    case 400:
      return 'Revisa los campos y sus límites antes de volver a enviar.';
    case 401:
      return context === 'login'
        ? 'Correo o contraseña incorrectos, o cuenta no disponible.'
        : 'La sesión ha terminado. Vuelve a ingresar.';
    case 403:
      return 'Tu rol no tiene permiso para esta operación.';
    case 404:
      return context === 'search'
        ? 'No se encontró un paciente con ese documento exacto.'
        : 'El recurso solicitado no está disponible.';
    case 409:
      if (context === 'assign')
        return 'No se puede asignar: revisa disponibilidad, servicio, triaje I/II o una asignación activa. Actualiza el censo.';
      if (context === 'release') return 'La ocupación cambió. Revisa de nuevo antes de liberar.';
      if (context === 'cleaning')
        return 'El estado o ciclo de limpieza cambió. Actualiza el censo y confirma de nuevo.';
      return context === 'register'
        ? 'El documento ya está registrado. Puedes usar la búsqueda exacta.'
        : 'El estado cambió. Actualiza e inténtalo de nuevo.';
    case 503:
      return 'El servicio de datos de pacientes no está disponible. Contacta con la administración.';
    default:
      return 'El servidor no pudo completar la solicitud. Inténtalo de nuevo más tarde.';
  }
}
