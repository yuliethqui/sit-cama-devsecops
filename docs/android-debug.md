# SIT-CAMA: Android debug con el backend Docker local

## Causa comprobada del aviso

El mensaje «La conexión segura no está configurada. Contacta con la
administración.» se genera en `apiErrorMessage`, en `core/api.service.ts`, al
recibir `ApiConfigurationError`. `ApiService.request()` produce ese error si
`API_BASE_URL` está vacío. **En ese caso no se envía ninguna petición HTTP.**

La fábrica de `API_BASE_URL`, en `core/api-config.ts`, selecciona `nativeApiUrl`
cuando se ejecuta con Capacitor. Tanto `environment.ts` como
`environment.prod.ts` tenían ese campo vacío; `ionic build` utiliza producción
por defecto. Además, el validador rechaza HTTP en producción. El aviso inicial
era, por tanto, un bloqueo local de configuración, no un error de autenticación,
de PostgreSQL, de TLS o de CORS recibido del servidor.

También se inspeccionaron las demás capas: WebView con origen
`https://localhost`, `server.cleartext=false`, ausencia de Network Security
Configuration, permiso INTERNET presente y CORS de desarrollo limitado a
`http://localhost:8100`. Cambiar únicamente la URL no solucionaba todas las capas.

## Solución y separación debug/release

- `environment.android-debug.ts` y la configuración Angular `android-debug`
  seleccionan exclusivamente `http://10.0.2.2:3000/api` para el emulador.
- Un plugin local `SitcamaRuntime` consulta el flag nativo `FLAG_DEBUGGABLE`.
  Angular espera esa lectura antes de crear los servicios HTTP. Si la lectura
  falla, el permiso debug queda desactivado.
- HTTP nativo exige simultáneamente entorno no productivo, opción
  `emulatorHttpDebug=true`, APK realmente depurable y URL exacta anterior.
  Un bundle debug copiado accidentalmente a un APK release no habilita HTTP.
- El interceptor del emulador utiliza `CapacitorHttp.request` solamente para esa
  API autorizada. No modifica globalmente fetch/XHR. El interceptor de sesión
  sigue gestionando Bearer, vencimiento, 401 y cancelación de la suscripción.
  Los errores nativos se convierten al contrato de `HttpErrorResponse`.
- Se mantiene `androidScheme=https`, `server.cleartext=false`,
  `allowMixedContent=false` y `usesCleartextTraffic=false`. No se desactivan
  controles de contenido mixto ni se añaden comodines de navegación.
- La política principal `src/main/res/xml/network_security_config.xml` bloquea
  HTTP. Solo `src/debug/res/xml/network_security_config.xml` introduce una
  excepción al host `10.0.2.2`, sin subdominios. Network Security Configuration
  limita por host; el cliente limita además al puerto 3000 y la base `/api`.
  Se bloquea también loopback explícitamente, incluso en Android 17.
- Las redirecciones están desactivadas en ese transporte para no reenviar
  credenciales/tokens a otro destino. No se añaden logs de solicitudes;
  `loggingBehavior=none` evita que el puente Capacitor registre sus argumentos.
- JWT y datos de pacientes continúan exclusivamente en memoria. No se añaden
  almacenamiento web, Preferences, bases locales, caché de respuestas ni cookies
  de sesión. El backend sigue devolviendo `Cache-Control: no-store`.

Esta excepción solo sirve para datos y cuentas sintéticos en el emulador local.
Los entornos con datos reales deben usar la configuración de producción y una
API HTTPS con certificado confiable. El código no determina si una base contiene
datos reales: no utilizar este perfil contra una base de ese tipo.

## Generar e instalar el APK debug actualizado

Con Docker Desktop y el emulador abiertos, desde PowerShell:

```powershell
Set-Location 'C:\Users\Usuario\Downloads\SIT-CAMA-incremento-01'
docker compose -f compose.yaml -f compose.dev.yaml up -d api
Invoke-RestMethod http://localhost:3000/api/health
Set-Location apps/mobile
.\android-debug.cmd
```

El comando selecciona el Node local 22.23.5, compila Angular con
`--configuration=android-debug`, ejecuta `cap sync android` y
`:app:assembleDebug`. Requiere un JDK compatible (JDK 21 es el utilizado en la
verificación), SDK Android y las dependencias ya instaladas. No cambia el Node
o JDK global ni modifica secretos. Si la terminal necesita seleccionar JDK 21,
usar el JDK configurado en Android Studio como `JAVA_HOME` para esa terminal.

Archivo generado:

`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

Instalarlo en el emulador:

```powershell
# Desde apps/mobile, en esta máquina:
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices
& $adb -s emulator-5554 install -r .\android\app\build\outputs\apk\debug\app-debug.apk
& $adb -s emulator-5554 shell am start -n edu.sitcama.mvp/.MainActivity
```

Cambiar `emulator-5554` por el identificador que muestre `adb devices` si es otro.
También se puede abrir el proyecto con `npx.cmd cap open android` y ejecutar la
variante **debug** desde Android Studio después de compilar/sincronizar el perfil
correcto. No volver a ejecutar `cap add android`: la plataforma ya existe.

Comandos equivalentes explícitos, con Node compatible en PATH:

```powershell
ionic.cmd build --configuration=android-debug
npx.cmd cap sync android
Set-Location android
.\gradlew.bat :app:assembleDebug
```

`ionic build` sin esa configuración genera el perfil de producción; no habilita
la excepción local y su `nativeApiUrl` vacía conserva el bloqueo intencional.
No es necesario reinstalar Capacitor ni cambiar contraseñas o claves de cifrado.

## Verificar el login

1. Comprobar el health anterior y que Docker publica `127.0.0.1:3000`.
   `10.0.2.2` es el alias del host accesible desde el emulador estándar. No es
   la dirección adecuada para un teléfono físico ni para otros emuladores.
2. Instalar el APK nuevo y abrir SIT-CAMA. No debe mostrarse el aviso de
   configuración al intentar entrar.
3. Introducir unas credenciales ficticias inexistentes: debe aparecer el mensaje
   de correo/contraseña incorrectos, correspondiente al **401 real** de Docker.
   Esto prueba la conexión sin crear o modificar cuentas ni pacientes.
4. Introducir después las credenciales válidas de una cuenta sintética ya creada
   para comprobar el acceso a inicio y los permisos del rol. No hay credenciales
   predeterminadas y no se han cambiado las de ninguna cuenta existente.
5. Salir o cerrar la app; no queda una sesión persistente. No registrar pacientes
   reales ni usar el perfil debug con información clínica real.

Si aparece error de red en lugar de 401, confirmar que el APK contiene el perfil
`android-debug`, que Docker está activo y que se está usando el emulador estándar.
El firewall o un emulador alternativo pueden tener otra configuración de red.
No ampliar a HTTP global para resolver esos casos.

## CORS

`compose.dev.yaml` permite únicamente `http://localhost:8100` y
`https://localhost` como orígenes explícitos de desarrollo. No se añaden por
defecto a producción. El transporte nativo no depende del preflight del
navegador; aun así se comprobó el preflight real de la WebView, que devuelve
204 y `Access-Control-Allow-Origin: https://localhost` con el override activo.
La política de producción sigue aceptando solo orígenes HTTPS explícitos.

## Release

Configurar `environment.prod.ts` con la API HTTPS real y usar:

```powershell
ionic.cmd build --configuration=production
npx.cmd cap sync android
Set-Location android
.\gradlew.bat :app:assembleRelease
```

Sin credenciales de firma el resultado es `app-release-unsigned.apk`, útil para
verificar compilación y recursos, no para publicación. La política empaquetada
release no contiene `cleartextTrafficPermitted=true` ni excepción al emulador.
La firma y entrega release no forman parte de este cambio.

## Validación local realizada

- `ionic.cmd build --configuration=production` y `cap sync android` aprobados.
- Release sin firmar compilado y política XML efectiva inspeccionada con `aapt2`:
  HTTP bloqueado, incluidos los dominios de loopback explícitos.
- `ionic.cmd build --configuration=android-debug`, sync y APK debug aprobados.
- 23 pruebas unitarias frontend y 20 E2E de navegador aprobadas; lint aprobado.
- Cuatro pruebas CORS aprobadas. No se modificó el código de los controladores,
  DTO, autenticación, SQL, contraseñas o claves de cifrado de la API.
- Dos pruebas instrumentadas aprobadas en Android 17/API 37: contexto correcto
  de la app y política efectiva HTTP limitada al host del emulador.
- APK debug instalado y login probado en su WebView contra Docker: 401 esperado
  con credenciales ficticias inexistentes; desaparece el aviso de configuración.
  No se creó ningún usuario ni paciente para esa prueba. No se afirma haber
  autenticado una cuenta válida en ese smoke de Android.
- La prueba automatizada está en `apps/mobile/e2e/android-smoke.cjs` y se ejecuta
  con `node e2e/android-smoke.cjs` desde `apps/mobile`, después de instalar el APK.
  La captura sintética queda en `test-results/android-debug-login.png`.
- Las pruebas de navegador usan su esquema temporal, que se elimina; sus
  comparaciones confirmaron que las tablas públicas no cambiaron.

Se conservan los secretos y el volumen PostgreSQL. No se ha publicado en GitHub.

## Archivos modificados o añadidos

| Grupo | Archivos |
| --- | --- |
| URL y autorización debug | `src/app/core/api-config.ts`, `native-runtime.service.ts`, `emulator-http.interceptor.ts`, `api.service.spec.ts`, `emulator-http.interceptor.spec.ts` |
| Arranque y build | `src/main.ts`, `src/environments/environment.android-debug.ts`, `angular.json`, `capacitor.config.ts`, `android-debug.cmd` |
| Android | `android/app/src/main/AndroidManifest.xml`, `src/main/res/xml/network_security_config.xml`, `src/debug/res/xml/network_security_config.xml`, `MainActivity.java`, `SitcamaRuntimePlugin.java` |
| Pruebas | `NetworkPolicyTest.java`, test plantilla `ExampleInstrumentedTest.java` (identificador corregido), `e2e/android-smoke.cjs`, `playwright.config.ts` (espera de arranque en frío) |
| Desarrollo backend | `compose.dev.yaml`, `apps/api/src/configure-app.spec.ts` |
| Documentación | Esta guía, `docs/android.md`, `docs/frontend.md`, `docs/registro-uso-llm.md`, `apps/mobile/README.md` |

`cap sync` regenera los assets y su configuración en `android/app/src/main/assets`;
estos archivos son salidas de compilación, no configuraciones editadas a mano.

Referencias técnicas: [Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)
y [configuración de Capacitor](https://capacitorjs.com/docs/config).
