# SIT-CAMA · Incremento 05: presentación y experiencia de usuario

## Alcance y plan

Rediseño del frontend existente. Como ampliación posterior expresamente autorizada
se corrigió únicamente el orden de auditoría del backend; se conservan servicios
frontend, reglas y contratos. Se inspeccionaron plantillas, componentes, SCSS global,
tema, navegación, guards, interceptores, sesión, URL nativa y Socket.IO.

1. **Tema y componentes:** tokens de color/espacio/tipografía, controles táctiles,
   estados coherentes, SCSS compartido y encabezados/filtros reutilizables.
2. **Navegación:** lateral en escritorio, inferior en móvil/tablet, etiquetas
   legibles, rol visible, teclado y acceso directo al contenido.
3. **Páginas:** login, inicio, registro/triaje, búsqueda, matriz de camas,
   prioridades/conexión del panel y auditoría compacta con filtros plegables.

Después de cada fase: pruebas unitarias, E2E frontend disponibles, lint e Ionic
build. Al cerrar: revisión de 360/768/1440 px, capturas y evidencia de regresión.

## Límites de la fase visual y excepción posterior

La fase exclusivamente visual no modificó backend, DTO, endpoints, esquema PostgreSQL, secretos, JWT,
RBAC, guards, servicios HTTP/Socket.IO, configuración Capacitor o red Android.
No se agregan dependencias. No se publica en GitHub.

`evidence/incremento-05/protected-sha256.json` registra las huellas iniciales de
73 archivos protegidos: backend/código SQL/pruebas API, contratos y servicios,
rutas y configuración de red. Al cierre visual confirmó **cero cambios**;
`preservation-visual-phase.json` conserva esa evidencia. Tras la autorización,
`preservation-result.json` confirma 71 intactos y solo dos cambios permitidos:
servicio de auditoría y su prueba de integración. No hay cambios inesperados
ni secretos en estos archivos.

Las pruebas operativas existentes usan API/PostgreSQL reales en esquemas de
prueba privados, con credenciales efímeras y pacientes ficticios; no se utilizarán
datos de pacientes reales para capturas o demostraciones.

## Evidencia

Fase 1: 40/40 unitarias aprobadas; E2E 30/32 aprobados, dos fallos existentes de
paginación de auditoría. Diagnóstico aislado con el frontend mostrando exactamente
las respuestas: primera página IDs `8,6,54,52,...,14`; segunda `8,6,4,2,12,10`.
La consulta API proyecta `id::text` y ordena su alias como texto, mientras el cursor
compara bigint. No es un cambio de SCSS ni se corrige con una ordenación visual.
Se conservó la aserción que detecta duplicados y no se modificó el backend.
En el cierre exclusivamente visual aún no se había recibido autorización y se
conservó el backend. Después el usuario autorizó expresamente la corrección
puntual, verificada en la sección siguiente. No se ocultan duplicados ni se
debilita la prueba.

## Corrección puntual autorizada de auditoría

Aplicada después de la entrega visual, sin cambiar columnas, esquema, endpoints,
DTO, filtros, cursor, JWT/RBAC, auditoría transaccional ni formato de respuesta:

- `apps/api/src/audit/audit.service.ts`: `ORDER BY audit_events.id DESC` ordena la
  columna bigint, evitando el alias textual de `SELECT id::text`. El ID en JSON
  sigue siendo texto para mantener precisión.
- `apps/api/test/panel-audit.integration.spec.ts`: nueva regresión HTTP/PostgreSQL
  con IDs de 4/5/6/16/19 dígitos, incluido `9223372036854775807`; recorre páginas de
  1, 3 y 100 elementos y comprueba orden numérico exacto, cursores, precisión,
  ausencia de duplicados/omisiones y finalización. Solo usa el esquema privado.

La regresión falló antes del cambio (devolvía `99999` antes del máximo bigint) y
pasó después. Resultados de esta corrección:

| Comprobación ejecutada | Resultado |
| --- | --- |
| API `npm run test:cov` | 13 suites, **168 pruebas aprobadas** |
| Cobertura API | 99,49 % sentencias; 92,44 % ramas; 99,03 % funciones; 100 % líneas |
| API `npm run build` | Aprobado |
| Frontend `npm run test:e2e` | **35/35 aprobados**, incluidos los dos fallos anteriores |
| Integridad de datos | Esquemas temporales eliminados, tablas públicas sin cambios |
| Docker | Imagen/contenedor API actualizados; PostgreSQL y volúmenes conservados |

Evidencia adicional: `evidence/incremento-05/audit-fix-results.json`,
`audit-fix-e2e-last-run.json`, `preservation-result.json` y cobertura en
`apps/api/coverage/`. No se modificó el frontend ni se regeneró el APK en esta
corrección. No se repitieron sus pruebas unitarias/lint/build porque ese código
permaneció idéntico; sus resultados visuales anteriores siguen documentados abajo.
No hubo publicación en GitHub.

## Historial de comprobaciones del rediseño, antes de la corrección

| Fase | Unitarias | E2E reales | Lint / tipos / formato | Ionic build |
| --- | --- | --- | --- | --- |
| 1 · Tema/componentes | 40 aprobadas | 30 aprobados, 2 fallos de auditoría | Aprobado | Aprobado |
| 2 · Navegación | 42 aprobadas | 30 aprobados, 2 fallos de auditoría | Aprobado | Aprobado |
| 3 · Páginas, resultado final | 42 aprobadas | 33 aprobados, 2 fallos de auditoría | Aprobado | Aprobado |

El resultado final E2E son 35 escenarios: se conservan los 32 anteriores y se
añaden tres recorridos a 360, 768 y 1440 px. Los tres nuevos pasan. Comprueban
login, registro confirmado, búsqueda, censo de 38 camas, diálogo de asignación,
aviso de triaje real, panel y auditoría. Verifican ausencia de desbordamiento,
controles de al menos 44 px, navegación por teclado, Escape en diálogo, filtro
plegable, densidad de auditoría y ausencia de persistencia de datos sensibles.
Los filtros desplegados miden menos de 270 px en escritorio y plegados menos
de 90 px en móvil/tablet; las tarjetas de auditoría a 360 px menos de 320 px.

`phase-03-results.json` conserva los códigos reales de cada comprobación: E2E
devuelve 1 por los dos fallos citados; unitarias, lint e Ionic build devuelven 0.
En ese cierre visual no se declaró la suite completa aprobada. Los esquemas de prueba se eliminaron
y las comparaciones de tablas públicas pasaron sin cambios.

Android: compilación debug, Capacitor sync e instalación aprobados. Las dos
pruebas instrumentales de la app pasaron en Android 17/API 37. El recorrido
`node e2e/android-panel-audit.cjs` pasó con el nuevo diseño: login, AudioContext
habilitado, aviso real I, reconexión tras corte TCP, vuelta de segundo plano,
auditoría y menú SERVICIOS. Usa esquema ficticio, reemplaza brevemente el listener
del puerto 3000 y restaura Docker mediante `finally`; la restauración fue exitosa.

También se compiló producción con `ionic build`, se sincronizó Capacitor y se
compiló `:app:assembleRelease`. El APK release mantiene
`usesCleartextTraffic=false`; no se distribuyó ni se configuró un nuevo servidor.
El último `www` y los assets sincronizados quedan en producción. Para reconstruir
debug local debe usarse `android-debug.cmd`, que selecciona su entorno específico.

Se revisaron visualmente capturas de escritorio y móvil, incluido el espacio de
filtros y las tarjetas. Se guardaron [33 capturas responsive y 2 Android](evidence/incremento-05/CAPTURAS.md).

## Sistema visual y experiencia

- Identidad verde oscuro, verde suave, blanco y neutros. Tokens centralizados,
  escala de espacio 4/8/12/16/20/24/32/40 px y radios 8/14/20 px.
- Fuentes del sistema, sin descargas externas ni nuevas dependencias. Texto de
  formularios de 16 px, lectura de 14–15 px, etiquetas y metadatos de 12–13 px.
- Botones Ionic y controles de 44–48 px, foco visible, skip link al contenido,
  etiquetas de campo y errores asociados mediante `aria-describedby`.
- Navegación lateral desde 1024 px e inferior por debajo; los nombres cortos
  móviles conservan el nombre accesible completo. Mismos permisos y rutas.
- Login con identidad móvil visible, inicio con accesos de rol en una sola
  cuadrícula, registro por bloques y guía de escritorio, búsqueda con área de
  resultado independiente y confirmaciones legibles.
- Camas por servicio, leyenda textual/símbolos y colores existentes, cuatro
  estados, fecha real de consulta y acciones según los permisos existentes.
- Prioridades con número romano, texto, tiempos y color; pendientes explícitos.
  Estado de conexión derivado del servicio existente. Ningún aviso inventado.
- Auditoría con filtros compactos plegables mediante `<details>` nativo, tabla
  semántica en escritorio/tablet y tarjetas a menos de 768 px.
- Respeto de safe areas Android y de `prefers-reduced-motion`.

Se calcularon siete combinaciones de contraste: texto principal 11,95:1,
secundario 5,57:1, botón primario 8,77:1, éxito 6,41:1, error 6,33:1, advertencia
6,19:1 y límites de campos 3,41:1. Los pares seleccionados superan 4,5:1 para texto
y 3:1 para bordes. Ver `evidence/incremento-05/contrast.json`. Esto no constituye
una certificación integral WCAG ni una prueba con lectores de pantalla.

## Archivos nuevos y modificados

En `apps/mobile/`:

- `src/theme/variables.scss`: tokens de tema y colores Ionic.
- `src/styles/workspace.scss`: entrada SCSS; nuevos `_foundation.scss`,
  `_navigation.scss`, `_pages.scss`: fundamentos, navegación y páginas.
- Nuevos `src/app/shared/page-header.component.ts`,
  `filter-disclosure.component.ts` y su prueba; presentación de
  `triage-summary.component.ts` actualizada.
- `src/app/shell/shell.component.{html,ts}`: nombres cortos móviles y accesibilidad.
- Plantillas de login, home, patients/register, patients/search, beds, panel y
  audit. Sus TypeScript solo agregan imports de componentes de presentación;
  los métodos de carga, validación, envío, permisos y sesión se conservan.
  `login.page.ts` permanece sin cambios.
- `playwright.config.ts`: tres proyectos visuales adicionales sin retirar los
  proyectos/pruebas anteriores. Nuevo `e2e/responsive.spec.ts`.
- `e2e/panel-audit.spec.ts` y `e2e/android-panel-audit.cjs`: abrir los filtros cuando
  están plegados. Se mantienen las aserciones funcionales, incluida la que falla.

Documentación: este informe y `docs/evidence/incremento-05/`, además del enlace
en `README-MVP.md`. Builds generan `www/`, assets Android y APK; no son cambios
de lógica ni configuración de seguridad. No hubo cambios de dependencias.

## Reproducir y revisar

Desde la raíz, con Docker PostgreSQL activo y sin operaciones simultáneas sobre
las tablas públicas durante las comprobaciones de integridad:

```powershell
$env:Path = (Resolve-Path .\apps\mobile\.tools\node-v22.23.5-win-x64).Path + ';' + $env:Path
cd apps/mobile
npm.cmd run test:unit
npm.cmd run test:e2e
npm.cmd run lint
& "$env:APPDATA\npm\ionic.cmd" build
```

Las pruebas E2E usan el `dist` backend existente y puertos locales 3101/4200.
Para repetir únicamente la revisión visual:

```powershell
npx.cmd playwright test --project "Visual 360" --project "Visual 768" --project "Visual 1440"
```

Para revisar en navegador contra Docker usar `apps/mobile/serve.cmd`, abrir
`http://localhost:8100` y las cuentas ficticias existentes. Confirmar login,
registro I/II/pendiente, búsqueda exacta, filtros/acciones por rol del censo,
conexión/aviso real del panel y filtros de auditoría. Probar Tab/Enter y Escape.
No deben ocultarse los fallos de paginación citados ni probar con pacientes reales.

Para generar el APK local: `apps/mobile/android-debug.cmd`, con JDK 21 y Android
SDK configurados. Resultado en `android/app/build/outputs/apk/debug/app-debug.apk`.
La prueba Android requiere un emulador abierto y ese APK instalado.

## Limitaciones

- El fallo de paginación hallado en la fase visual quedó corregido y verificado
  tras la autorización expresa; los dos errores históricos ya no están pendientes.
- Las 168 pruebas API corresponden a la corrección posterior autorizada, no a
  las fases exclusivamente visuales. No se atribuyen resultados históricos a
  ejecuciones nuevas.
- Verificación responsive en Chromium y un emulador Android, no en iOS,
  dispositivo físico, todos los navegadores, alturas o escalas de fuente.
- Audio audible, lectores de pantalla y aceptación visual humana integral
  siguen requiriendo revisión. No se cambiaron reglas clínicas ni pendientes
  funcionales de los incrementos anteriores.
- No hubo publicación en GitHub, firma de distribución ni despliegue.
