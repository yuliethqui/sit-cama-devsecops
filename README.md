# SIT-CAMA

La aplicación principal es el MVP académico en `apps/api` y `apps/mobile`: backend NestJS, cliente Ionic/Angular y proyecto Android/Capacitor. Utiliza únicamente datos sintéticos. La aplicación Express de `src/server.js`, su prueba, el Dockerfile raíz y los paquetes raíz se conservan como proyecto histórico del taller DevSecOps.

## Estructura

- `apps/api/`: API, pruebas, SQL inicial y Dockerfile del MVP.
- `apps/mobile/`: Ionic, E2E y código nativo Android.
- `.ci/` y `.github/workflows/mvp-ci.yml`: controles del MVP.
- `docs/legacy-workflows/`: workflow histórico de Cosign archivado, sin ejecución activa.
- [Informe de integración](docs/INTEGRACION-LOCAL-MVP.md), [lista exacta de 277 archivos](docs/integration/source-manifest.json) y [evidencias seleccionadas](docs/evidence/integration-manifest.json).

## Preparación y ejecución

Usar Node **22.23.5**, npm y Docker con contenedores Linux. Android requiere JDK 21 y el SDK indicado por el proyecto Gradle. No se distribuyen Node, dependencias, navegadores ni herramientas descargadas dentro del repositorio.

```powershell
Push-Location apps/api
npm.cmd ci
Pop-Location
Push-Location apps/mobile
npm.cmd ci
npx.cmd playwright install chromium
Pop-Location
```

Antes de iniciar la aplicación, preparar un `.env` local a partir de `.env.example` solo si no existe. Completar los secretos mediante generación local; no publicarlos. Conservar las claves que ya protejan registros. El esquema inicial SQL solo se aplica automáticamente a un volumen nuevo: no recrear ni borrar un volumen existente para actualizar el sistema.

```powershell
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
Push-Location apps/mobile
npm.cmd start
Pop-Location
```

Las cuentas de demostración se crean mediante el procedimiento de [README-MVP](README-MVP.md), sin credenciales predeterminadas. Consultar [frontend](docs/frontend.md), [Android](docs/android.md) y [Android debug](docs/android-debug.md). `cap sync android` regenera los archivos nativos de Capacitor excluidos de Git; no reemplazar el código personalizado debug/release.

## Pruebas y controles

Tras instalar las dependencias, estos runners crean PostgreSQL desechable y no utilizan el volumen de trabajo:

```powershell
node .ci/test-08.cjs probe
node .ci/test-08.cjs api
node .ci/run-tests.cjs
node --test .ci/policy.test.cjs
```

`run-tests.cjs` incluye cobertura API/frontend, builds, lint frontend y E2E. La API no define un script propio de lint. Las pruebas de integración no deben ejecutarse mediante un fallback accidental hacia una base de trabajo. `positive-controls.cjs` crea un repositorio Git desechable y ejecuta operaciones Git: no se ejecutó durante la integración local, que las prohíbe.

Controles de secretos y fuente, cuando Docker esté disponible:

```powershell
node .ci/security.cjs secrets
node .ci/security.cjs source
```

El comando histórico `node --test test/basico.test.js` comprueba exclusivamente la prueba Express del taller. Ejecutar `npm test` en la raíz no valida el MVP.

## Resultados y límites conocidos

Se preserva una ejecución **previa** del 16/11/2026, finalizada a las 15:13:02 UTC: **244/244 API**, sonda original **3/3** e intervalo invertido rechazado con 400 sin nueva lectura auditada. Ver [resumen derivado con procedencia y hashes](docs/evidence/api-recheck-2026-11-16/summary.json). No se atribuye ese resultado a una nueva ejecución en esta carpeta. Los informes originales de incrementos anteriores conservan su contexto histórico y pueden describir fallos ya corregidos.

El motor sigue siendo una demostración I/II; otros casos requieren revisión clínica. No hay aprobación clínica para automatizar III–V, ni cierre completo de las ocho HU. El panel no representa episodios activos o espera asistencial real. El release Android exige configurar HTTPS real; no debe habilitarse tráfico HTTP de producción para la demostración.

La publicación continúa **bloqueada** por `.ci/publication-review.json`. El único workflow activo del MVP limita la publicación a una ejecución manual en `main`, con gates aprobados y revisión de riesgos correspondiente. No se publicaron imágenes ni se firmó una nueva imagen SIT-CAMA durante esta integración. La firma histórica de una base de contenedor no es una firma de SIT-CAMA.

El [marcador sintético histórico de Gitleaks](docs/TRATAMIENTO-MARCADOR-GITLEAKS.md) requiere tratamiento explícito. No se borró historial ni se aplicaron excepciones.
