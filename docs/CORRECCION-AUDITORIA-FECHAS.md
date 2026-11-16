# Corrección puntual de precisión de fechas de auditoría

Fecha: 16 de noviembre de 2026, America/Bogota. Runtime ejecutado: Node 22.23.5 en Windows.

La corrección está aplicada exclusivamente al filtro temporal de auditoría. Las pruebas unitarias focalizadas y el build pasan. La validación HTTP/PostgreSQL de la regresión original sigue pendiente porque Docker y PostgreSQL de pruebas no están disponibles. No se declara una suite completa ni una integración aprobada.

## Causa y reproducción

`AuditService.list` comparaba `from` y `to` mediante `Date.parse`. Para `2026-01-01T00:00:00.123457Z` y `2026-01-01T00:00:00.123456Z`, ambas conversiones producen `1767225600123`: el intervalo invertido por un microsegundo se aceptaba como si sus extremos fueran iguales.

Antes de modificar el servicio se ejecutó el nuevo caso unitario de reproducción: **1 fallido**, porque la promesa devolvía `{ items: [], nextCursor: null, limit: 25 }` en lugar de rechazar el rango. Ese caso usa un doble del cliente PostgreSQL; reproduce la aceptación del servicio y no constituye una prueba de comparación SQL real.

También se intentó ejecutar la regresión original mediante `.ci/test-08.cjs probe`. El runner falló antes de iniciar PostgreSQL/Jest: Docker no pudo acceder a su configuración local ni conectar con `docker_engine`. Este intento no reprodujo el HTTP 200 de forma independiente. El resultado HTTP previo continúa documentado en `INCREMENTO-08-PRUEBAS.md` y sus evidencias históricas, sin modificarlas.

## Corrección

Se sustituye la comparación JavaScript por una consulta parametrizada dentro de la transacción existente, después de comprobar el permiso AUDITOR vigente:

```sql
SELECT $1::timestamptz <= $2::timestamptz AS ordered
```

La consulta se realiza si existe alguno de los extremos. Ambos se envían como texto original, sin pasar por `Date`, truncar ni reformatear fracciones. Un extremo ausente se envía como NULL y no se añade un límite al filtro. Un resultado falso genera 400 antes de consultar eventos o registrar `READ_AUDIT`.

Se utiliza el mismo tipo que `recorded_at`, por lo que la comparación y los filtros comparten las reglas de PostgreSQL para zonas horarias, fechas sin zona y precisión. PostgreSQL documenta una resolución de un microsegundo para `timestamptz`: [tipos fecha/hora de PostgreSQL 17](https://www.postgresql.org/docs/17/datatype-datetime.html). Las fracciones superiores a seis decimales conservan la interpretación de PostgreSQL; no se amplía la precisión del esquema.

Los errores PostgreSQL de fecha/formato/zona `22007`, `22008` y `22009` se convierten en 400 genérico. Los demás errores se propagan al tratamiento existente. Se conserva `AuditQuery` con su validación ISO estricta, sin ampliar los formatos aceptados.

Permanecen intactos el contrato JSON, filtros inclusivos `>=` y `<=`, cursor int64, orden numérico `ORDER BY audit_events.id DESC`, paginación, RBAC, esquema, cifrado y auditoría transaccional. Hay una consulta escalar adicional únicamente cuando se filtra por fechas; no se ejecutó una medición de rendimiento con PostgreSQL real.

## Archivos

- Modificado: `apps/api/src/audit/audit.service.ts`.
- Nuevo: `apps/api/src/audit/audit-date-validation.spec.ts` — 23 casos unitarios.
- Nuevo: `apps/api/test/audit-date-validation.integration.spec.ts` — 15 casos HTTP/PostgreSQL preparados para el harness aislado existente.
- Nuevo: este informe. Reportes de esta ejecución en `.reports/audit-date-fix/`, separados de las evidencias históricas.

No se modificó `apps/api/test/audit-precision.regression.spec.ts`. SHA-256 antes/después: `4afce0dfc97728b16f0523fe2e7bb9e98a465acd88f5ad39ad453d8b9475e6b2`.

## Casos añadidos

Los casos cubren igualdad exacta y de distintas precisiones, inversión por 1 microsegundo, offsets negativos y positivos equivalentes, intervalo válido de 1 microsegundo, cruce del epoch, día bisiesto, cambio de día, años remotos admitidos por el DTO, un único extremo y formatos sin hora/zona ya admitidos. También verifican entradas inválidas en ambos filtros, ausencia de lectura auditada ante rechazo, errores PostgreSQL sanitizados y conservación de errores no relacionados con fechas.

Durante la preparación de los nuevos casos se detectó que el DTO existente rechaza el año `0001`. Se corrigió ese fixture nuevo a `0100` y se conservó el rechazo de `0001` en las pruebas de validación. No se cambió el DTO ni ninguna expectativa de la regresión original.

## Resultados ejecutados

| Comprobación | Resultado real |
| --- | --- |
| Reproductor unitario antes del cambio | 1 fallido: el servicio aceptaba el intervalo invertido |
| Regresión original mediante runner Docker | Bloqueada antes de iniciar las pruebas |
| Unitarias focalizadas después del cambio | 26/26 aprobadas: 23 nuevas y 3 existentes |
| Todas las pruebas API, con cobertura configurada | 244 casos descubiertos; 89 aprobados; 155 fallidos por preparación de PostgreSQL; 12 suites aprobadas y 6 fallidas |
| Regresión original dentro de la suite completa | Sus 3 casos fallan en la preparación, sin ejecutar sus escenarios SQL/HTTP |
| Nueva integración de fechas | Sus 15 casos fallan en la preparación, sin ejecutar sus escenarios SQL/HTTP |
| Build `npm run build` | Aprobado, salida 0 |
| Lint `npm run lint` | No disponible: el paquete API no define script/configuración de lint; salida 1 |

La ejecución completa se forzó con `TEST_PGHOST=127.0.0.1`, `TEST_PGPORT=1`, base de pruebas `sitcama_ci`, usuario de prueba y contraseña efímera. Se evitó así cualquier fallback hacia las credenciales o la base de trabajo. Las seis suites fallidas reportan PostgreSQL no disponible o `ECONNREFUSED`; no se accedió a datos ni se creó ningún esquema.

La cobertura parcial, con el alcance y los umbrales originales intactos, es: sentencias **76,28 %**, ramas **55,55 %**, funciones **47,11 %** y líneas **76,65 %**. **El gate global del 80 % falla.** Estas cifras no sustituyen una medición con las integraciones ejecutadas ni una suite final verde.

Reportes principales:

- `.reports/audit-date-fix/unit-before.json`.
- `.reports/audit-date-fix/docker-before/probe-run.json`.
- `.reports/audit-date-fix/unit-targeted-after.json`.
- `.reports/audit-date-fix/api-all-attempt.json` y `api-all-attempt.log`.
- `.reports/audit-date-fix/coverage-summary.json` y `full-coverage/`.
- `.reports/audit-date-fix/summary.json` y `preservation.json`.

## Conservación y comprobación pendiente

La comparación con las 178 huellas conservadas antes del incremento de pruebas anterior detecta únicamente el cambio previsto en `audit.service.ts`. Incluye comprobación de los archivos protegidos de frontend, Android, motor clínico, SQL, Docker, DevSecOps y `.env`. Además se verificaron las huellas tomadas al inicio de esta tarea para la regresión original, DTO, esquema, paquetes y controles principales. Las salidas de build y los nuevos reportes son artefactos generados.

No se cambiaron dependencias, secretos, datos, volúmenes, controles, umbrales ni archivos de CI. No se publicó nada ni se alteró el bloqueo de publicación existente.

Cuando Docker esté disponible, ejecutar desde la raíz con el Node fijado por el proyecto:

```powershell
$auditFixNode = (Resolve-Path 'apps/mobile/.tools/node-v22.23.5-win-x64/node.exe').Path
$env:NODE_OPTIONS = '--preserve-symlinks --preserve-symlinks-main'
$env:SITCAMA_REPORT_DIR = '.reports/audit-date-fix/recheck'
& $auditFixNode .ci/test-08.cjs probe
& $auditFixNode .ci/test-08.cjs api
```

Estos runners existentes crean un PostgreSQL desechable con credenciales nuevas y no usan `.env` ni el volumen de trabajo. La fase `probe` debe comprobar los tres casos originales; la fase `api` debe comprobar las 244 pruebas actuales y el umbral global de cobertura. Hasta obtener esos resultados, la integración permanece pendiente.
