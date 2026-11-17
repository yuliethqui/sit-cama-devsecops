# SIT-CAMA — Incremento 08: pruebas y defecto encontrado

Fecha local: 14 de noviembre de 2026, America/Bogota; resultados técnicos en UTC del 15 de noviembre.

**Trabajo detenido por la condición solicitada:** una nueva regresión demuestra que auditoría acepta un intervalo invertido por un microsegundo. Se conserva la prueba fallida habilitada. No se modificó lógica de producción, Docker, endpoints, reglas clínicas, claves o datos existentes. No se publicó ni fusionó nada.

## Resultados antes y después

| Suite | Línea base ejecutada | Ampliación completa aprobada | Sonda final de auditoría |
|---|---:|---:|---:|
| API/Jest | 168 aprobadas, 0 fallidas | 203 aprobadas, 0 fallidas | 2 aprobadas, **1 fallida** |
| Frontend/Vitest | 76 aprobadas, 0 fallidas | 105 aprobadas, 0 fallidas | No corresponde |
| Navegador/Playwright | 35 aprobadas, 0 fallidas | 43 aprobadas, 0 fallidas | No corresponde |

Se añadieron **38 casos API, 29 unitarios frontend y 8 ejecuciones E2E** (cuatro escenarios en dos perfiles). Tras sumar la sonda hay 206 casos API únicos: 205 aprobados y uno fallido en **dos ejecuciones complementarias**. No se volvió a ejecutar la suite API completa después del defecto, conforme a la orden de detenerse; no se presenta una suite final verde.

La línea base también ejecutó build API, lint, typecheck E2E e Ionic build con éxito. Tras añadir las pruebas frontend se ejecutó lint/typecheck/Prettier con éxito. No hubo instalación de dependencias ni cambios de umbrales.

| Cobertura | Statements antes/después | Branches antes/después | Functions antes/después | Lines antes/después |
|---|---:|---:|---:|---:|
| API | 99.49 / 99.49 % | 92.44 / 92.44 % | 99.03 / 99.03 % | 100 / 100 % |
| Frontend TypeScript | 84.49 / 84.49 % | 86.59 / 86.81 % | 81.63 / 81.63 % | 87.45 / 87.45 % |

La cobertura API posterior corresponde a la ejecución completa de **203 casos**, anterior a la sonda fallida. No se recalculó una cobertura final después de detenerse. El alcance permanece igual: Jest mide src salvo main.ts; Angular mide TypeScript de src/app, excluyendo specs y la configuración declarativa de rutas. No representa cobertura de HTML generado o Android. La cobertura ya era alta: estos casos aportan semántica de entradas y regresiones aunque apenas cambie el porcentaje.

Los conteos y métricas se extraen de los JSON de Jest, Vitest y Playwright, sin contar dos veces las ejecuciones independientes de los 11 casos nuevos de triaje. Véanse [summary.json](evidence/tests/summary.json) y [manifest.json](evidence/tests/manifest.json).

## Inventario y selección sin duplicados

Se inspeccionaron las suites existentes, DTO, validadores, motor de triaje, guards, servicios, backlog y criterios HU-01/HU-03, HU-05/HU-06 y HU-02/HU-08. Ya existían pruebas de tokens ausentes/expirados, matrices de los seis roles, estados incompatibles/BLOCKED, varias solicitudes simultáneas entre dos instancias, rollback por auditoría, paginación bigint hasta int64, filtros, desconexión y reconexión del panel. Se conservaron y volvieron a pasar; no se reescribieron para aumentar el conteo.

La nueva selección añade límites exactos que faltaban, tipos no probados, persistencia de texto hostil, manipulación estructural de JWT, sincronización determinista con otra transacción, error diferido al COMMIT, salida DOM y precisión temporal. Los textos de prueba son ficticios; las reglas I/II siguen siendo académicas y no se crean III–V.

## Matriz de pruebas nuevas

| Grupo y archivo | Casos válidos / inválidos | Resultado esperado | Resultado observado |
|---|---|---|---|
| `test/triage-boundaries.spec.ts` — 11 | SpO2 0/100; Glasgow 3/9/13/14; EVA 0/7/10; paro o Glasgow I junto a criterios II | I con 0 min, II con 30 min o pendiente/null; prioridad I; demoOnly | 11 aprobados |
| `register-validation.spec.ts` — 29 | Seis campos nulos; Unicode en blanco; documento con SQLi o 41 caracteres; nombre 161/control NUL/DEL; motivo 1001; Glasgow/EVA fuera de rango o decimales; NaN/Infinity/string/booleano/objeto en controles numéricos; tres combinaciones válidas de extremos/Unicode | Formulario inválido, campo tocado y error visible, cero HTTP; aceptar extremos y texto permitido | 29 aprobados |
| `input-security.integration.spec.ts` — 12 | Nombre null/número/objeto/array; motivo null/número; Glasgow/EVA decimales o tipos incorrectos; saturación objeto; booleano array | 400 sanitizado, sin pacientes o auditorías parciales | 12 aprobados |
| Mismo archivo — 2 | Longitudes mínimas 3/2/1 y máximas 40/160/1000, con trim y Unicode | Registro 201 y búsqueda exacta del mismo paciente | 2 aprobados |
| Mismo archivo — 3 | Nombre/motivo con XSS sintético o SQLi; código de cama con SQLi que sí llega al lookup | Texto preservado cifrado; búsqueda sin identidad/motivo; lookup exacto 404; 38 camas conservadas | 3 aprobados |
| Mismo archivo — 5 | Login con role suministrado por cliente; JWT con role modificado, alg none, HS384 y not-before futuro | Login 400; los cuatro JWT 401 sin datos | 5 aprobados |
| Mismo archivo — 1 | Asignación esperando un bloqueo real de paciente mientras otra transacción confirma un nuevo triaje pendiente | Esperar COMMIT, devolver 409; cama disponible, sin asignación | Aprobado; espera observada en pg_stat_activity, una sola solicitud en cola |
| Mismo archivo — 1 | Constraint trigger diferido falla al COMMIT, después de insertar asignación y auditoría | 500 sin detalle interno; rollback de cama/asignación/auditoría; recuperación tras retirar el trigger del fixture | Aprobado |
| `e2e/input-security.spec.ts` — 2 perfiles | Código de cama con marcado img/onerror, mediante fixture de respuesta | Texto literal, sin nodo img ni ejecución; 38 tarjetas y sin acciones MEDICO para COORDINADOR | 2 ejecuciones aprobadas |
| Mismo archivo — 2 perfiles | Backend confirma registro pero el navegador pierde la respuesta | Error de conexión; sin reenvío automático; reintento manual recibe duplicado 409 | 2 ejecuciones aprobadas |
| Mismo archivo — 2 perfiles | Panel conectado recibe 401 cuyo error contiene marcado hostil | Login por expiración, socket cerrado, panel retirado y texto del servidor no mostrado | 2 ejecuciones aprobadas |
| Mismo archivo — 2 perfiles | Atrás del navegador después de logout, desde confirmación de paciente | No recuperar confirmación/identificador ni ruta clínica | 2 ejecuciones aprobadas |
| `audit-precision.regression.spec.ts` — 1 | Intervalo de un instante exacto con offsets equivalentes y vecinos a ±1 µs | Inclusión de ambos extremos; excluir vecinos | Aprobado |
| Mismo archivo — 1 | Nuevo evento coincidente entre dos páginas filtradas | Cursor numérico sin duplicar/omitir el conjunto inicial; el evento nuevo aparece al reiniciar | Aprobado |
| Mismo archivo — 1 | from mayor que to en 1 µs, dentro del mismo milisegundo | 400; no registrar una lectura válida | **Fallido: 200 y READ_AUDIT adicional** |

El E2E de escape DOM usa una respuesta controlada de censo, sin modificar PostgreSQL; comprueba el sink Angular y no se presenta como prueba SQL. Las pruebas de SQL, cifrado y permisos sí pasan por NestJS/PostgreSQL reales aislados. No hubo fuzzing ilimitado ni carga contra el servidor en uso.

## Defecto real: INC08-AUDIT-01

Endpoint existente: `GET /api/audit/events`, con rol AUDITOR y estos filtros:

```text
from=2026-01-01T00:00:00.123457Z
to=2026-01-01T00:00:00.123456Z
```

Ambas cadenas pasan la validación ISO existente. El rango está invertido en un microsegundo. El resultado esperado es 400, siguiendo la regla ya implementada para rangos invertidos normales.

Observado en instancia temporal:

```json
{
  "expectedStatus": 400,
  "actualStatus": 200,
  "response": { "items": [], "nextCursor": null, "limit": 25 },
  "javascriptFromMillis": 1767225600123,
  "javascriptToMillis": 1767225600123,
  "auditReadsBefore": 5,
  "auditReadsAfter": 6
}
```

Causa localizada en `apps/api/src/audit/audit.service.ts:11`: la comparación de `Date.parse(from)` con `Date.parse(to)` pierde la precisión inferior al milisegundo. PostgreSQL conserva microsegundos en timestamptz; los filtros posteriores producen un conjunto vacío, pero el servicio acepta la consulta e inserta READ_AUDIT.

Impacto comprobado: validación inconsistente de intervalos y registro de una lectura aceptada para un rango inválido. No se confirmó exposición clínica, SQL injection, cambio de permisos ni alteración de datos existentes. El evento adicional ocurrió únicamente en el fixture temporal.

**Propuesta de corrección, no aplicada:** comparar ambos extremos sin pérdida de precisión y con semántica compatible con timestamptz. Puede validarse mediante una consulta parametrizada en la transacción existente antes de consultar/registrar la lectura, o con un comparador ISO/offset que preserve esa precisión. No resolverlo truncando ambos extremos a milisegundos ni cambiando la expectativa a 200. Tras autorización habría que conservar los dos casos válidos, hacer pasar la regresión y repetir la suite completa/coverage. No se modificó el servicio.

Durante la escritura de pruebas se corrigió una expectativa **nueva** que inicialmente comparaba el documento descifrado sin normalizar; el contrato existente almacena mayúsculas. Esos dos fallos eran de la prueba recién redactada y no defectos de producción. No se cambiaron expectativas de ninguna prueba previa ni se ocultó la regresión temporal.

## Reproducción y aislamiento

Los nuevos tests de integración exigen TEST_PG* explícitos y no leen `.env`. Usan esquemas privados aleatorios sobre el contenedor PostgreSQL desechable del runner. Los nombres de bases admitidos corresponden a los harnesses temporales ya existentes, incluido CI/DAST; no hay fallback hacia la base de trabajo. Se usan credenciales y claves nuevas en memoria y se retiran el esquema y el contenedor al terminar, incluso tras el fallo.

Desde la raíz, PowerShell:

```powershell
$env:Path = (Resolve-Path 'apps/mobile/.tools/node-v22.23.5-win-x64').Path + ';' + $env:Path
$env:SITCAMA_REPORT_DIR = '.reports/tests/after'

# Reproducción mínima del defecto: termina con código 1 mientras no se corrija.
node .ci/test-08.cjs probe

# Tras autorizar/corregir, ejecución completa contra otra base temporal:
node .ci/test-08.cjs api
node .ci/test-08.cjs e2e

Push-Location apps/mobile
npm.cmd run test:cov
npm.cmd run lint
Pop-Location
```

Node debe ser 22.23.5 en este equipo; en otras máquinas instalar un runtime compatible en vez de asumir que existe `.tools`. Requiere Docker Desktop con contenedores Linux. E2E usa API propia en 3101 y navegador en 4200, con `reuseExistingServer=false`; no utiliza la API de trabajo en 3000. El runner de API utiliza puerto PostgreSQL aleatorio en loopback. No hace build ni despliegue de imágenes del proyecto.

El comando `node .ci/tests-evidence.cjs` recopila resultados ya existentes, sin ejecutar pruebas, en `docs/evidence/tests`. La cobertura posterior almacenada no se debe confundir con una nueva ejecución completa tras el defecto. No se ejecutaron esos comandos de ampliación después de detectar el problema: solo se recopilaron evidencias y documentación.

## Archivos y conservación

Nuevos archivos de pruebas: `apps/api/test/{triage-boundaries.spec.ts,inc08-harness.ts,input-security.integration.spec.ts,audit-precision.regression.spec.ts}`, `apps/mobile/src/app/patients/register-validation.spec.ts`, `apps/mobile/e2e/input-security.spec.ts`.

Infraestructura de pruebas/reportes: `.ci/test-08.cjs`, `.ci/tests-evidence.cjs`, este informe, `docs/evidence/tests/*` y entrada en `docs/registro-uso-llm.md`.

Se verificaron por SHA-256 **178 archivos protegidos**, incluyendo fuentes de producción, configuración Docker/seguridad/Android, dependencias y `.env`: ningún cambio. Las pruebas anteriores se conservaron. No se tocaron pacientes o volúmenes existentes ni se modificaron contraseñas, claves o configuración de publicación. Los contenedores de desarrollo permanecen operativos; se retiraron los contenedores de pruebas. La inspección de conservación es de archivos y del aislamiento utilizado; no se inventa un snapshot nuevo de la base persistente anterior a este incremento.

Pendiente tras revisión: corregir INC08-AUDIT-01 con autorización y repetir la suite completa. Se conserva el bloqueo de publicación existente del incremento Docker; este trabajo no lo modifica ni declara completado el incremento con una regresión fallida.
