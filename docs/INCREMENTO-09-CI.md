# Incremento 09 — Corrección de GitHub Actions

Validación local del 16 de noviembre de 2026 en `feature/sit-cama-mvp-entrega-3`, sobre `a9b668340d0f51eaf639332a63c84ca4e4ffc528`. El árbol estaba limpio al inicio. No se preparó el índice, no se crearon commits y no se hizo push, merge, publicación ni firma de imágenes.

Se obtuvieron los registros completos del [run 43906234662](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43906234662): [quality](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43906234662/job/133435721706) e [image-dast](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43906234662/job/133435722225). Los originales permanecen en `.reports/inc09/github-*-full.log`, ignorados. Sus SHA-256 constan en el [resumen de evidencia](evidence/incremento-09/summary.json). Esos resultados remotos corresponden al commit anterior; no representan una nueva ejecución de Actions.

**Análisis de fuentes: reproducción y corrección.** El exportador de `.ci/security.cjs` invocaba `rg`, sin instalarlo. Con `rg` fuera del PATH se reprodujo `spawnSync rg ENOENT`. Ahora `.ci/source-files.cjs` usa el Git ya requerido por checkout y por el control de secretos: `git ls-files --cached --others --exclude-standard -z`. Incluye archivos versionados y nuevos no ignorados, archivos ocultos y rutas con espacios; evita metadatos Git y evidencia histórica, como antes. Los archivos versionados continúan incluidos aunque coincidan con un ignore. Rechaza rutas externas, entradas no regulares y archivos `.env` secretos; conserva `.env.example`. Los errores de Git detienen el análisis. Se requiere un checkout Git: no se ofrece un modo alternativo que escanee parcialmente una carpeta exportada sin Git.

No se añadieron paquetes ni ejecutables al proyecto. Las siete pruebas nuevas comprueban enumeración, exclusiones, secretos, límites de rutas y errores. El workflow las ejecuta junto a las tres pruebas de política. El análisis completo terminó con `rg` ausente: Semgrep analizó 95 archivos, con cero hallazgos y cero errores; se mantuvieron ambas configuraciones de reglas y todas las condiciones de bloqueo. La enumeración real se verificó en Windows y Linux.

**Reportes Docker: reproducción y corrección.** La etapa `verify` heredaba UID 0. Con `--cap-drop=ALL`, ese proceso no podía escribir en el bind mount `/reports` propiedad del runner (UID 1001, modo 0755). La reproducción Linux obtuvo `EACCES` tanto al crear cobertura como al abrir el JSON. No era un fallo de las 244 pruebas.

`apps/api/Dockerfile` establece `HOME=/tmp` y `USER 10001:10001` solo en `verify`; el runtime de producción conserva su usuario y endurecimiento. `.ci/verify-runtime.cjs` exige también ese UID, escribe en `/tmp/sitcama-reports` de la capa del contenedor y recoge los archivos con `docker cp` antes de eliminar su contenedor específico. No usa un bind mount de escritura para Jest, ni permisos globales, ni root para la aplicación. Intenta recoger evidencia incluso si falla la suite y propaga los fallos de suite o de copia. La nueva ejecución real exportó `coverage/` y `api-tests.json` y terminó con código 0.

**Pruebas generales: causa independiente.** El registro completo de `.ci/run-tests.cjs` mostró 244/244 pruebas API, build API, lint/build frontend y 43/43 E2E correctos; fallaron tres pruebas unitarias frontend (102 correctas): una de `NativeRuntimeService` y dos de `RealtimeService`. No se dedujo su causa de los otros arreglos.

La versión instalada de `@angular/build` configura `isolate: false` por defecto en `src/builders/unit-test/runners/vitest/plugins.js`, para compartir contexto entre archivos como Karma. Según el orden, otros specs cargan Capacitor o Socket.IO antes de los `vi.mock`; desactivar solo `fsModuleCache` no evita esa contaminación. Un orden controlado que carga primero `api.service.spec.ts` reprodujo exactamente 102 aprobadas y 3 fallidas. Con `isolate: true` en las opciones de pruebas de `apps/mobile/angular.json` pasaron 105/105 en el orden normal y en ese mismo orden controlado. No se cambiaron servicios, mocks, expectativas ni umbrales.

| Comprobación nueva local | Resultado comprobado |
| --- | --- |
| Infraestructura CI | 10/10 Windows (Node 22.15.0); 10/10 Linux (Node 22.23.5) |
| API Linux con PostgreSQL temporal | 18 suites, 244/244; reportes recogidos sin EACCES |
| Cobertura API (statements/branches/functions/lines) | 99.50 / 92.77 / 99.03 / 100.00%; umbral 80% en cada métrica |
| Frontend normal y orden de reproducción | 105/105 en cada ejecución, con cobertura |
| Cobertura frontend (mismo orden de métricas) | 84.49 / 86.81 / 81.63 / 87.45%; umbral 80% en cada métrica |
| Lint y builds | ESLint, tipos E2E, Prettier, build Angular, Ionic CLI build y build API correctos |
| E2E Linux/Chromium | Código 0: 42 al primer intento, 1 aprobado tras reintento, 0 fallos finales, 0 omitidos |
| Runtime final real | Flujos existentes, RBAC, HEALTHCHECK y filesystem de solo lectura correctos; UID 10001 |
| Semgrep | 95 archivos, 0 hallazgos, 0 bloqueos |
| Trivy fuentes/IaC | 3 MEDIUM en locks; 1 LOW del Dockerfile Express histórico; 0 HIGH/CRITICAL |
| Trivy imagen / SBOM | 43 MEDIUM, 12 LOW y 2 UNKNOWN; 0 HIGH/CRITICAL; CycloneDX con 1681 componentes |
| DAST autenticado | MEDICO y AUDITOR alcanzaron handlers autenticados; RBAC y acceso anónimo correctos; 0 bloqueantes, 1 alerta informativa por rol |
| Gitleaks historial | Correcto, 0 hallazgos con configuración y digest existentes |
| Gitleaks cambios sin preparar / espacios / rutas | Árbol candidato con 0 secretos; `git diff --check`, espacios de archivos nuevos, sintaxis y referencias CI correctos |
| actionlint | 1.7.12 correcto; archivo descargado verificado con SHA-256 fijado en CI |

Los reportes completos, imágenes de prueba, navegador y herramientas descargadas se mantienen en ubicaciones locales ignoradas. Los contenedores de API, PostgreSQL y E2E usaron nombres aleatorios y bases efímeras; se eliminaron sus propios contenedores y redes. No se conectaron volúmenes persistentes ni se alteraron datos existentes. Un primer intento del arnés descartable de E2E falló porque su UID numérico no tenía entrada passwd para Ionic; se corrigió únicamente esa imagen local y se repitió. No fue un cambio de la aplicación.

**Archivos de la corrección.**

- Nuevos: `.ci/source-files.cjs`, `.ci/source-files.test.cjs`, este informe y `docs/evidence/incremento-09/{summary.json,manifest.json}`.
- Modificados: `.ci/security.cjs` (inventario), `.ci/verify-runtime.cjs` (reportes), `apps/api/Dockerfile` (usuario de verificación), `.github/workflows/mvp-ci.yml` (ejecutar regresiones de infraestructura), `apps/mobile/angular.json` (aislamiento solo de tests).
- Solo espacios: `apps/api/test/panel-audit.integration.spec.ts` (línea vacía al final) y `apps/mobile/android/build.gradle` (espacios en línea vacía). El diff ignorando espacios y líneas vacías esté vacío.

**Integridad y límites.** Los otros 304 archivos previamente versionados conservan sus bytes. Permanecen intactos el motor clínico, contratos, SQL, frontend funcional, pruebas clínicas, lockfiles, reglas, herramientas fijadas, umbrales, DAST, hooks y controles de publicación. `.ci/publication-review.json` conserva exactamente el SHA-256 `40a0e9871c2e040a63f35738785e0e6717b653f842d19c2ea15f18f1ce826265` y `status: blocked`, incluyendo su investigación de zlib. Los escaneos sin bloqueantes no resuelven esa investigación ni autorizan publicación.

El hook nativo se invocó explícitamente con éxito, pero el índice estaba vacío: esto no acredita los cambios sin preparar. `core.hooksPath` no está configurado en este clon y Python pre-commit no está disponible. El árbol candidato completo, incluidos archivos nuevos y evidencia, se comprobó además con Gitleaks: cero hallazgos. No se repitieron localmente los controles positivos que crean repositorios Git temporales, ni la verificación de firma pública de la base mediante Cosign; sus archivos y condiciones siguen intactos. No se firmó una imagen SIT-CAMA.

La orquestación `.ci/run-tests.cjs` no se ejecutó como un único proceso en el host sin dependencias instaladas; se probaron sus seis fases equivalentes en contenedores Linux con los locks y Node fijados. La ejecución E2E detectó una inestabilidad en `e2e/input-security.spec.ts:67` (Mobile Chrome, timeout al pulsar «Actualizar panel» antes de comprobar el 401). Pasó al reintentar bajo la configuración existente. Queda pendiente investigar esa inestabilidad fuera de esta corrección y confirmar el workflow completo en un nuevo run de Actions después de la revisión y publicación autorizadas. No se afirma que Actions esté aprobado con estos cambios aún locales.

**Comandos propuestos para revisión y publicación posterior; no ejecutados.**

```powershell
Set-Location 'C:\Users\Usuario\Downloads\SIT-CAMA-github'
git branch --show-current
git status --short
git diff --check
git diff -- .ci .github/workflows/mvp-ci.yml apps/api/Dockerfile apps/api/test/panel-audit.integration.spec.ts apps/mobile/angular.json apps/mobile/android/build.gradle
# Revisar también los archivos nuevos, que no aparecen en git diff sin preparar.
Get-Content .ci/source-files.cjs, .ci/source-files.test.cjs, docs/INCREMENTO-09-CI.md
Get-Content docs/evidence/incremento-09/summary.json, docs/evidence/incremento-09/manifest.json
# Configurar el hook antes del commit, tras revisar este cambio de configuración local.
git config --local core.hooksPath .githooks
git add -- .ci/security.cjs .ci/source-files.cjs .ci/source-files.test.cjs .ci/verify-runtime.cjs .github/workflows/mvp-ci.yml apps/api/Dockerfile apps/api/test/panel-audit.integration.spec.ts apps/mobile/angular.json apps/mobile/android/build.gradle docs/INCREMENTO-09-CI.md docs/evidence/incremento-09/summary.json docs/evidence/incremento-09/manifest.json
git diff --cached --check
git diff --cached --stat
node .ci/precommit.cjs
git commit -m "fix(ci): make scans portable and fix report permissions and test isolation"
git push origin feature/sit-cama-mvp-entrega-3
# El push a esta feature no dispara mvp-ci: usar workflow_dispatch o el PR permitido.
gh workflow run mvp-ci.yml --ref feature/sit-cama-mvp-entrega-3 -f publish_image=false
gh run list --workflow mvp-ci.yml --branch feature/sit-cama-mvp-entrega-3 --limit 5
```

La publicación de imagen continúa restringida al dispatch revisado en main y a los controles existentes. Este procedimiento propuesto no cambia main ni desbloquea la revisión.
