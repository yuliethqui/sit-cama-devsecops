# SIT-CAMA — cliente Ionic Angular/Capacitor

El frontend ya existe en `apps/mobile`: login, navegación por rol, registro con
triaje inicial, búsqueda exacta y censo de camas. No volver a ejecutar `ionic start`
sobre ese directorio. Consultar [la guía completa](frontend.md) para Docker,
configuración, contratos, pruebas y alcance.

**Actualización de debug Android:** ya se generó y verificó un APK debug con
excepción HTTP limitada al host del emulador. Usar `.\android-debug.cmd` desde
`apps/mobile` y consultar [la guía actual de Android debug](android-debug.md).
Los siguientes comandos describen la preparación de una configuración release HTTPS.

```powershell
# Desde apps/mobile, con Node compatible y Android Studio/SDK/JDK:
# Antes: configurar nativeApiUrl con HTTPS real y certificado confiable.
npm.cmd run build
npx.cmd cap sync android
```

Después de cada cambio del frontend:

```powershell
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

La configuración conserva `cleartext=false` y WebView HTTPS. No se habilita HTTP
inseguro como solución de producción. La app release no llega al PC mediante
`localhost`: necesita un endpoint HTTPS alcanzable y permitir `https://localhost`
como origen WebView en la API. HU-02/HU-08 siguen pendientes; HU-05/HU-06 tienen
flujo local y pruebas documentados en [su informe](HU-05-HU-06.md).
Se verificó el APK debug en el emulador Android 17/API 37; no se afirma una
validación en teléfono físico ni una entrega release firmada.
