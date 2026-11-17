import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import type { HttpInterceptorFn } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { catchError, defer, map, throwError } from 'rxjs';

import { API_BASE_URL, EMULATOR_API_URL } from './api-config';
import { NativeRuntimeService } from './native-runtime.service';

export const NATIVE_HTTP = new InjectionToken<Pick<typeof CapacitorHttp, 'request'>>('Native HTTP', {
  providedIn: 'root',
  factory: () => CapacitorHttp,
});

// Only this debug/local API uses native HTTP. WebView mixed-content policy stays enabled.
export const emulatorHttpInterceptor: HttpInterceptorFn = (request, next) => {
  const runtime = inject(NativeRuntimeService);
  const base = inject(API_BASE_URL);
  if (!runtime.android || !runtime.debuggable || base !== EMULATOR_API_URL || !request.url.startsWith(`${base}/`))
    return next(request);
  const nativeHttp = inject(NATIVE_HTTP);
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', Origin: window.location.origin };
  for (const name of request.headers.keys()) headers[name] = request.headers.get(name)!;
  if (request.body !== null && !request.headers.has('Content-Type')) headers['Content-Type'] = 'application/json';
  return defer(() =>
    nativeHttp.request({
      url: request.urlWithParams,
      method: request.method,
      headers,
      ...(request.body !== null ? { data: request.body } : {}),
      responseType: 'json',
      connectTimeout: 10000,
      readTimeout: 15000,
      disableRedirects: true,
    }),
  ).pipe(
    map((response) => {
      const options = {
        body: response.data,
        status: response.status,
        headers: new HttpHeaders(response.headers),
        url: request.url,
      };
      if (response.status < 200 || response.status >= 300)
        throw new HttpErrorResponse({ ...options, error: response.data });
      return new HttpResponse(options);
    }),
    catchError((error: unknown) =>
      throwError(() =>
        error instanceof HttpErrorResponse ? error : new HttpErrorResponse({ status: 0, url: request.url }),
      ),
    ),
  );
};
