import { inject, InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { environment } from '../../environments/environment';

import { NativeRuntimeService } from './native-runtime.service';

export const EMULATOR_API_URL = 'http://10.0.2.2:3000/api';

export interface ApiEnvironment {
  production: boolean;
  browserApiUrl: string;
  nativeApiUrl: string;
  emulatorHttpDebug?: boolean;
}
export function resolveApiUrl(
  config: ApiEnvironment,
  native: boolean,
  origin: string,
  androidDebuggable = false,
): string {
  const configured = native ? config.nativeApiUrl : config.browserApiUrl;
  if (!configured) return '';
  try {
    const url = new URL(configured, origin);
    if (url.username || url.password || url.search || url.hash) return '';
    if (config.production && url.protocol !== 'https:') return '';
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (
      native &&
      url.protocol === 'http:' &&
      !(
        androidDebuggable &&
        !config.production &&
        config.emulatorHttpDebug === true &&
        url.href.replace(/\/$/, '') === EMULATOR_API_URL
      )
    )
      return '';
    return url.href.replace(/\/$/, '');
  } catch {
    return '';
  }
}
export const API_BASE_URL = new InjectionToken<string>('SIT-CAMA API', {
  providedIn: 'root',
  factory: () =>
    resolveApiUrl(
      environment,
      Capacitor.isNativePlatform(),
      window.location.origin,
      inject(NativeRuntimeService).debuggable,
    ),
});
