import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/auth.interceptor';
import { emulatorHttpInterceptor } from './app/core/emulator-http.interceptor';
import { NativeRuntimeService } from './app/core/native-runtime.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideAppInitializer(() => inject(NativeRuntimeService).load()),
    provideHttpClient(withInterceptors([authInterceptor, emulatorHttpInterceptor])),
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
  ],
});
