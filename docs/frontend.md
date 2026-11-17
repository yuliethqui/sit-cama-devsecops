# Frontend SIT-CAMA — Ionic Angular standalone

Implementación académica del 14/11/2026. Solo datos sintéticos. No constituye
software clínico validado ni completa las ocho historias de usuario.

## Contratos inspeccionados antes de implementar

Se leyeron los controladores, servicios, DTO, guardas JWT/RBAC, motor de triaje,
filtro de errores y pruebas HTTP de `apps/api/src`. Se comprobó el servidor Docker
activo y se ejecutaron las pruebas de integración de la API contra PostgreSQL.
Los E2E del frontend utilizan las respuestas del mismo backend real en un esquema
temporal; no sustituyen las respuestas de éxito por fixtures.

| Operación real | Contrato | Acceso en la interfaz |
| --- | --- | --- |
| `POST /api/auth/login` | `{email,password}` → `{access_token,role}` | Los seis roles |
| `POST /api/patients` | `{document,fullName,triage:{chiefComplaint,spo2,glasgow,eva,paroInminente,dolorToracicoTipico}}` → `{patientId,provisional,createdAt,triage}` | ENFERMERO, MEDICO |
| `POST /api/patients/search` | `{document}` → `{patientId,provisional,createdAt,triageStatus,latestTriage}` | ENFERMERO, MEDICO, ADMISIONES |
| `GET /api/beds` | Array de `{code,service,status,updated_at}` | Los seis roles |
| `POST /api/beds/:code/assign` | `{patientId,service}` → cama y asignación confirmadas | MEDICO |
| `GET /api/beds/:code/assignment` | Cama y UUID de la ocupación activa; lectura auditada | MEDICO |
| `POST /api/beds/:code/release` | `{assignmentId}` → cama en limpieza | MEDICO |
| `POST /api/beds/:code/complete-cleaning` | `{expectedUpdatedAt}` → cama disponible | SERVICIOS |

Las acciones de camas y sus nuevas rutas se describen en [HU-05/HU-06](HU-05-HU-06.md).
La interfaz no llama a lectura clínica detallada o anexado de triaje. La búsqueda muestra exclusivamente
los campos de su respuesta: nunca nombre, documento, motivo ni signos. No se
asigna un nivel desde el cliente. La API propone I/II o devuelve `level=null` y
revisión pendiente; III–V no se implementan en el frontend.

Los límites del formulario siguen los DTO: documento ASCII de 3–40 caracteres,
iniciando con alfanumérico y admitiendo puntos/guiones; nombre de 2–160 sin
caracteres de control; motivo de 1–1000; SpO₂ entero 0–100, Glasgow entero 3–15,
EVA entero 0–10 y dos booleanos. Los espacios exteriores se recortan.

## Sesión y navegación

- `/login`: correo/contraseña, errores, validación y aviso de sesión vencida.
- `/app/home`: panorama y accesos según rol, información de alcance pendiente.
- `/app/register`: registro y resumen demostrativo confirmado por el servidor.
- `/app/search`: consulta exacta, resultado limitado, sin coincidencias y errores.
- `/app/beds`: censo completo, totales reales, filtro local por servicio/estado,
  confirmaciones de asignación/liberación/limpieza según rol, actualización tras
  cada operación, actualización manual y estado vacío. La capacidad esperada es 38; si la API
  devuelve otra cantidad, se muestra esa cantidad y una advertencia.

JWT exclusivamente en un signal en memoria, sin cookies, localStorage,
sessionStorage, Preferences, IndexedDB ni service worker. Recargar termina la
sesión. Se programa el vencimiento usando `exp`; la decodificación del JWT solo
controla la experiencia, mientras la API verifica firma, emisor, audiencia y rol.
Salir o recibir un 401 elimina el token, cancela solicitudes autenticadas y vuelve
al login. No existe refresh token ni endpoint de revocación: el logout es local.

El interceptor solo adjunta Bearer al prefijo exacto de la API configurada y nunca
al login ni a destinos externos. No hay reintentos automáticos de escrituras.
Las solicitudes tienen un límite de 15 segundos. Los errores visibles usan
mensajes fijos por estado HTTP, sin reproducir cuerpos, SQL ni datos de entrada.

Se usa el outlet de Angular para destruir las páginas al salir; se evita conservar
formularios o resultados en la caché de navegación de Ionic. Al confirmar un
registro se borran identificación y signos del formulario. La búsqueda borra el
documento al confirmar y elimina el resultado al cambiar o limpiar la consulta.
No hay historial persistente de pacientes ni borradores offline.

HU-02 y HU-08 tienen flujos reales: `/app/panel` exclusivamente MEDICO con avisos
Socket.IO y `/app/audit` exclusivamente AUDITOR con filtros y paginación. Ver
[contratos, evidencia y límites](HU-02-HU-08.md). El panel usa último triaje en 24 h,
sin identidad ni signos; “pendiente” deriva del registro existente. El sonido
requiere activación explícita. Se verificó reconexión en navegador y Android debug.
HU-05/HU-06 tienen acciones reales según rol en el censo; ver
[contratos, pruebas y límites](HU-05-HU-06.md).
Las guardas cliente son complementarias a las guardas del servidor.

## Probar con Docker en el navegador

Desde la raíz del proyecto, conservar el `.env` existente y sus claves:

```powershell
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
docker compose -f compose.yaml -f compose.dev.yaml ps
Invoke-RestMethod http://localhost:3000/api/health
Set-Location apps/mobile
.\serve.cmd
```

Abrir `http://localhost:8100`. Si ya hay un servidor en ese puerto, utilizarlo o
detener su proceso antes de iniciar otro. `serve.cmd` selecciona la distribución
local verificada Node 22.23.5 cuando existe. Para otros comandos en esta máquina:

```powershell
$env:Path = (Resolve-Path .\.tools\node-v22.23.5-win-x64).Path + ';' + $env:Path
node --version
```

Para compilar sin configurar el PATH de la terminal, ejecutar `.\build.cmd`
desde `apps/mobile`. El comando selecciona el Node local compatible y genera `www`.

En otra máquina, instalar Node compatible con Angular 22 (`^22.22.3`,
`^24.15.0` o `>=26.0.0`) y ejecutar `npm.cmd ci` dentro de `apps/mobile`.
No se necesitan nuevas dependencias de producción para este frontend.

Usar cuentas sintéticas existentes. Si faltan cuentas, seguir el procedimiento
interactivo `db:seed-user` del [README](../README-MVP.md), con los datos de
conexión locales y una contraseña solicitada con `Read-Host -AsSecureString`.
No hay credenciales predeterminadas en la aplicación. Crear cuentas para los
seis roles solo cuando se necesiten y entrar con cada una para verificar el menú.

Para registrar/buscar, `PATIENT_DATA_KEY` y `PATIENT_HMAC_KEY` deben estar
configuradas en el `.env` y ser distintas. Si faltan, el frontend mostrará el
503 real. Consultar [HU-01/HU-03](HU-01-HU-03.md); no regenerar claves que
protejan datos existentes ni recrear el volumen PostgreSQL.

Recorrido manual sugerido:

1. Entrar como ENFERMERO o MEDICO; intentar enviar vacío y revisar validaciones.
2. Registrar un documento sintético único con SpO₂ 84, Glasgow 15, EVA 2,
   motivo y nombre ficticios. La API debe devolver propuesta I, referencia 0 min.
3. Buscar ese documento: el resultado no incluye nombre ni signos. Repetir el
   registro debe mostrar conflicto. Un documento sintético inexistente da vacío.
4. Registrar otro caso con SpO₂ 98 y EVA 8: II; con EVA 1 y Glasgow 15,
   sin las dos casillas, debe quedar pendiente de revisión, sin nivel III–V.
5. Abrir censo: 38 camas si se conserva el seed; aislamiento tiene 3. Probar un
   estado sin coincidencias y limpiar filtros. Verificar la misma vista en móvil.
6. Salir, usar Atrás e intentar una ruta protegida; debe requerir login. Recargar
   durante una sesión también requiere volver a ingresar.
7. ADMISIONES dispone de búsqueda/camas; COORDINADOR, SERVICIOS y AUDITOR
   tienen inicio/camas. No se habilitan registro o búsqueda fuera de sus permisos.

## CORS y entornos

La única modificación funcional del backend es su política CORS en
`configure-app.ts`; controladores, servicios, SQL y datos se conservan.

`compose.dev.yaml` establece `NODE_ENV=development` y permite
`http://localhost:8100` y `https://localhost` para la WebView. En producción no se habilita ese origen HTTP: solo se
admiten orígenes HTTPS explícitos, separados por comas en `APP_ORIGIN`. No se
utilizan comodines. El servicio normal de Compose sigue siendo producción;
utilizar ambos archivos para el desarrollo de navegador.

| Entorno | Archivo | URL |
| --- | --- | --- |
| Navegador desarrollo | `environment.ts` | `http://localhost:3000/api` |
| Navegador producción | `environment.prod.ts` | `/api`, detrás del mismo origen HTTPS |
| Android | `nativeApiUrl` del environment de compilación | Configurar una URL HTTPS real y alcanzable; vacía bloquea solicitudes |
| Emulador Android debug | `environment.android-debug.ts` | `http://10.0.2.2:3000/api`, solo con APK depurable y política debug por host |
| E2E aislado | `environment.e2e.ts` | `http://localhost:3101/api`, solo pruebas |

No incluir secretos en los environments: se entregan al dispositivo/navegador.

## Android / Capacitor

**Actualización:** para el APK debug y Docker local, usar
[la guía Android debug](android-debug.md). Ya se verificaron el APK y su login
(401 con credenciales ficticias inexistentes) en el emulador Android 17/API 37.
El resto de esta sección describe el requisito HTTPS de producción.

`capacitor.config.ts` usa `edu.sitcama.mvp`, nombre `SIT-CAMA`, `webDir=www`,
origen WebView HTTPS y `cleartext=false`. No se habilitan HTTP inseguro,
`allowMixedContent`, `usesCleartextTraffic` ni un servidor remoto de live reload
en el paquete de producción. El diseño contempla áreas seguras, teclado,
controles táctiles y zoom; la navegación móvil aparece en la parte inferior.

Antes de empaquetar, configurar `environment.prod.ts` → `nativeApiUrl` con una
API HTTPS alcanzable desde el emulador/dispositivo, con certificado confiable.
Permitir su origen WebView (`https://localhost`) explícitamente en `APP_ORIGIN`
del backend. Un navegador de producción puede usar su dominio HTTPS como otro
origen autorizado. TLS debe terminar en un proxy correctamente configurado.

`localhost` en Android designa el dispositivo. `10.0.2.2` es la dirección del host
para el emulador estándar, pero la API Docker actual está ligada a loopback y
habla HTTP: sustituir la URL por `http://10.0.2.2:3000` no es una configuración
de producción ni basta para una WebView HTTPS. Preparar un proxy HTTPS
alcanzable o un entorno HTTPS de pruebas; no exponer PostgreSQL.

La plataforma Android ya está agregada. Con Android Studio/SDK/JDK y el endpoint
seguro configurados, desde `apps/mobile`:

```powershell
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

La dependencia debe mantener la misma versión que `@capacitor/core`. Validar
el APK en dispositivo/emulador, certificados, conectividad y cierre de sesión.
La actualización Android debug ya verifica el APK en emulador; teléfono físico,
firma y validación release quedan pendientes.

## Pruebas reproducibles

Con PostgreSQL de Docker activo y dependencias de ambas aplicaciones instaladas:

```powershell
# Desde apps/api: usa el Node compatible del sistema o el local de mobile.
npm.cmd run test:cov
npm.cmd run build

# Desde apps/mobile, con Node compatible en PATH:
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.tools\playwright'
npx.cmd playwright install chromium --only-shell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Los E2E levantan el backend compilado en 3101 y Angular en 4200. Usan un esquema
aleatorio `sitcama_mobile_test_<UUID>` con `search_path` exclusivo, cuentas de los
seis roles, claves aleatorias y contraseña efímera. Al terminar eliminan solo
ese esquema y comparan conteos/huellas de las tablas públicas. No usan TRUNCATE
ni modifican usuarios/pacientes/camas existentes. Los puertos 3101/4200 deben
estar libres. Si el proceso se termina forzosamente antes del teardown puede
quedar un esquema temporal que debe revisarse y eliminarse de forma controlada.
No ejecutar contra una base con datos clínicos reales.

Se cubren sesión/expiración, cancelación al salir, Bearer solo al destino esperado,
permisos de los seis roles, validación y DTO, registro real I/II/pendiente,
duplicado, búsqueda limitada/sin coincidencias, filtros, error de red/reintento,
logout, recarga y ausencia de desbordamiento horizontal en móvil y escritorio.
Las capturas E2E muestran login, formulario, resumen de búsqueda y censo, con
datos exclusivamente sintéticos, y se guardan en
`apps/mobile/test-results` (ignorado en Git). Las trazas están desactivadas.

## Archivos del incremento

| Archivos | Cambio |
| --- | --- |
| `apps/mobile/src/app/core/*` | Contratos, configuración API, HTTP, sesión, interceptor, guardas, validación y pruebas |
| `apps/mobile/src/app/login/*`, `shell/*`, `home/*` | Login, menú por rol e inicio |
| `apps/mobile/src/app/patients/*`, `shared/*` | Registro, búsqueda y resumen demostrativo |
| `apps/mobile/src/app/beds/*` | Censo con filtros y estados de consulta |
| `apps/mobile/src/styles/workspace.scss`, `global.scss`, `index.html` | Diseño adaptable, tema claro y accesibilidad |
| `apps/mobile/src/main.ts`, `app.routes.ts`, `app.component.*` | Proveedores HTTP/Ionic y navegación protegida sin caché de páginas |
| `apps/mobile/src/environments/*`, `angular.json`, `.browserslistrc`, `capacitor.config.ts` | Desarrollo, producción, E2E y preparación Android |
| `apps/mobile/e2e/*`, `playwright.config.ts`, `.prettierignore` | Pruebas reales aisladas, móvil/escritorio y herramientas locales ignoradas |
| `apps/api/src/configure-app.ts`, `configure-app.spec.ts` | CORS por entorno y regresión |
| `compose.yaml`, `compose.dev.yaml`, `.env.example` | Orígenes explícitos y override de desarrollo |
| `docs/frontend.md`, `docs/android.md`, `docs/registro-uso-llm.md`, `apps/mobile/README.md`, `README-MVP.md` | Uso, alcance, trazabilidad y validación |

No se publica en GitHub ni se certifican CI, SAST, DAST, reglas clínicas,
actualizaciones en tiempo real o aceptación de las HU pendientes.

## Resultado local de la verificación — 14/11/2026

| Verificación ejecutada | Resultado |
| --- | --- |
| `apps/mobile`: pruebas unitarias y E2E | 32 unitarias y 26 E2E aprobadas; Chromium móvil y escritorio contra NestJS/PostgreSQL reales |
| `apps/mobile`: `npm.cmd run lint` | ESLint, tipos E2E y formato aprobados |
| `apps/mobile`: `ionic.cmd build --configuration=production` | Producción compilada; carga inicial 564,16 kB, transferencia estimada 144,68 kB |
| `apps/api`: `npm.cmd run test:cov` | 127 pruebas aprobadas; 99,74 % sentencias, 91,80 % ramas y 100 % funciones/líneas |
| `apps/api`: `npm.cmd run build` | Aprobada |
| Docker con override de desarrollo | API y PostgreSQL saludables; health devuelve `status=ok` |
| CORS real HTTP | Preflight 204 con origen `http://localhost:8100`; origen ajeno sin autorización CORS |
| Datos existentes | Las pruebas confirman tablas públicas sin cambios y eliminación del esquema E2E |
| Inspección visual | Capturas de login, registro móvil, búsqueda y censo revisadas |

La verificación es local. Revisión humana, CI remota, aceptación clínica y
validación Android física siguen pendientes.
