import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface SitcamaRuntimePlugin {
  read(): Promise<{ debuggable: boolean }>;
}
const runtimePlugin = registerPlugin<SitcamaRuntimePlugin>('SitcamaRuntime');

@Injectable({ providedIn: 'root' })
export class NativeRuntimeService {
  readonly android = Capacitor.getPlatform() === 'android';
  debuggable = false;
  async load(): Promise<void> {
    if (!this.android) return;
    try {
      this.debuggable = (await runtimePlugin.read()).debuggable === true;
    } catch {
      this.debuggable = false;
    }
  }
}
