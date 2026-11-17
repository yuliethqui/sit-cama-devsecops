# SIT-CAMA — preparación DevSecOps de Entrega 3

Fecha de validación local: **14 de noviembre de 2026, America/Bogota** (los reportes usan UTC).

**Resultado: controles preparados y ejecutados localmente; publicación bloqueada por la política de imagen.** No se ejecutó GitHub Actions, no se publicó en GHCR/GitHub y no se firmó con Cosign. Los resultados originales, el SBOM y los reportes ZAP están en [evidence/devsecops](evidence/devsecops/manifest.json).

## Inventario y alcance

Se revisaron el único workflow `.github/workflows/mvp-ci.yml`, `.pre-commit-config.yaml`, Dockerfile y `.dockerignore` de la API, los tres archivos Compose, scripts npm, Jest, Vitest, Playwright, inicialización PostgreSQL, controladores/DTO, cifrado y documentación (`plan-entrega.md`, `backlog.md`, documentación de HU y frontend/Android). No se encontró un enunciado completo de Entrega 3 en PDF/Word: esta matriz corresponde a la solicitud y los requisitos locales disponibles; falta contrastarla con la rúbrica externa si contiene condiciones adicionales.

Antes existían Gitleaks configurado en precommit/Actions, Jest con 80 % mínimo, un Semgrep instalado sin fijar versión, Trivy de filesystem para API y compilación Docker sin publicación. No había evidencia local de esos escáneres, cobertura exigible del frontend, escaneo de imagen, SBOM, firma/verificación ni DAST. El proyecto exportado **no contiene `.git`**: no se creó un repositorio en la raíz. `.gitignore.mvp` era una plantilla sin efecto; se añadió `.gitignore` activo.

Se amplió **el workflow existente**, sin duplicarlo. No cambian endpoints, roles, DTO, reglas clínicas, esquema, secretos ni configuración Android. La única modificación en código de producción de la API hace explícito `authTagLength: 16` en AES-GCM, igual a la longitud ya usada por el sobre v1. Se conserva el formato, AAD, algoritmo y claves; no requiere recifrado ni migración. Las pruebas de cifrado, integridad y regresión pasaron.

## Matriz de controles

| Control | Archivos principales | Política | Comprobación local | Pendiente en GitHub |
|---|---|---|---|---|
| Gitleaks 8.30.1 | `.gitleaks.toml`, `.pre-commit-config.yaml`, `.githooks/pre-commit`, `.ci/precommit.cjs`, `.ci/security.cjs` | Cualquier secreto detectado bloquea; redacción 100 %. Rechazar `.env` staged/tracked, salvo `.env.example`. | Exportación de fuente sin hallazgos; hook Git real rechaza commit con secreto sintético y acepta commit limpio en repositorio desechable. | Historial completo, instalación del hook en el repositorio real y bloqueo de PR. |
| Semgrep 1.185.0 | `.ci/rules/*`, `.ci/security.cjs` | Reglas OWASP JS/TS congeladas y dos reglas locales; ERROR bloquea, WARN visible. Errores del motor también fallan. | 0 hallazgos en fuente actual. Inyección SQL sintética detectada con exit 1 fuera del código de aplicación. | Mismo análisis en runner y evidencia de PR bloqueado. |
| Trivy 0.76.2 — dependencias | `.ci/security.cjs`, lockfiles npm | API y frontend, incluyendo dependencias dev; HIGH/CRITICAL bloquean aunque no exista parche. No hay ignorelist. | API: 2 MEDIUM; frontend: 1 MEDIUM; 0 HIGH/CRITICAL. | Base de advisories actualizada en cada ejecución CI. |
| Trivy — configuración/imagen | `apps/api/Dockerfile`, `.ci/security.cjs` | HIGH/CRITICAL bloquean. También conservar severidades menores en JSON. | Dockerfile: 27 comprobaciones satisfactorias. Imagen: **38 HIGH + 1 CRITICAL**, bloqueo real con exit 1. | Resolver o evaluar técnicamente cada hallazgo antes de publicación. |
| Syft 1.57.1 | `.ci/security.cjs`, `.ci/tools.lock.json` | SBOM CycloneDX JSON obligatorio, generado del mismo archivo de imagen que se escanea. | **CycloneDX 1.7, 3469 componentes**, imagen y SHA-256 del archivo registrados. | Adjuntar/atestiguar el SBOM al digest publicado. |
| Cosign 3.1.4 | `.ci/publish.cjs`, job `publish-verify` | Keyless OIDC, digest inmutable, issuer e identidad exactos; verificar firma y atestación del SBOM. | Solo sintaxis y revisión del flujo. **No se firmó ni verificó una imagen real.** | OIDC, GHCR, Fulcio/Rekor y prueba real de identidad/digest. |
| ZAP 2.17.0 | `.ci/dast.cjs`, `.ci/dast-seed.cjs` | DAST activo autenticado; MEDIUM/HIGH bloquean. Ausencia de reporte, sitio o lecturas autenticadas falla. | API y PostgreSQL efímeros en red interna; dos reportes HTML/JSON; 0 MEDIUM/HIGH, 1 aviso informativo por rol. | Ejecución en runner y ampliación del contrato DAST. |
| Pruebas/build | `.ci/run-tests.cjs`, Jest, Angular, Playwright | Mínimo 80 % en statements, branches, functions y lines por backend/frontend; lint sin warnings. | **168 API + 76 unitarias frontend + 35 E2E**, builds API/Ionic y lint satisfactorios. | Ejecución Linux hospedada y protección de rama con checks obligatorios. |
| Integridad del pipeline | workflow, `.ci/tools.lock.json` | Actions por SHA, herramientas/imágenes por versión y digest; lectura de contenido por defecto; publicación manual y aislada. | `actionlint 1.7.12` y sintaxis JS correctos; checksum del linter verificado. | Configurar revisores del environment y políticas del repositorio. |

Los números exactos y fechas provienen de [summary.json](evidence/devsecops/summary.json), [tests.json](evidence/devsecops/tests.json) y reportes asociados; no equivalen a un run de Actions. Las versiones/digests están en `.ci/tools.lock.json`. Las bases de vulnerabilidades cambian: repetir un escaneo puede producir hallazgos distintos aun usando la misma imagen.

## Evidencia funcional y cobertura

| Alcance | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| API | 99.49 % | 92.44 % | 99.03 % | 100 % |
| Frontend TypeScript | 84.49 % | 86.59 % | 81.63 % | 87.45 % |

Jest conserva su alcance existente `src/**/*.ts`, excluyendo únicamente `main.ts`. La cobertura del frontend mide TypeScript de `src/app`, incluyendo páginas, guardias, sesión, HTTP, transporte Android y Socket.IO. Excluye specs y el archivo declarativo `app.routes.ts`; su configuración de acceso se prueba y sus cargas lazy se recorren mediante E2E. Las plantillas HTML generadas y bootstrap/configuración de compilación no forman parte de ese porcentaje. No se presenta como cobertura de líneas HTML o Java Android. Se conserva la prueba de los ocho flujos en 35 E2E, con roles, errores, censo, asignación/liberación/limpieza, avisos y auditoría, y anchos 360/768/1440.

Se añadieron pruebas útiles de login inválido/concurrente, borrado de contraseña, aceptación/rechazo de sesión, menús de seis roles, mensajes públicos sanitizados, transporte debug cerrado ante fallos, contratos HTTP, conflictos de registro y errores de búsqueda. La prueba de carga dinámica de rutas con Vitest no resultó fiable; se conserva la comprobación declarativa y la carga real mediante navegador.

La validación corre con PostgreSQL nuevo en tmpfs y puerto aleatorio en loopback. Las pruebas API/E2E siguen creando y retirando únicamente sus propios esquemas. No utilizan el volumen `pgdata`. Se corrigieron el `npm.cmd` fijo de Playwright y la lectura obligatoria de `.env` para permitir CI Linux sin secretos locales. Los resultados JSON de Jest, Vitest y Playwright permiten verificar los conteos sin transcribirlos manualmente.

## DAST: alcance comprobado y límite

El runner crea una red Docker `--internal`, PostgreSQL en tmpfs y un contenedor de la imagen examinada. **No publica puertos** y no acepta una URL externa como destino. Genera secretos y tres cuentas ficticias en memoria, obtiene JWT mediante `/api/auth/login`, ejecuta ZAP y elimina solo los contenedores/red/directorio temporal de esa ejecución. No usa `.env`, cuentas locales, pacientes existentes ni volúmenes nombrados. Los reportes persistidos se redactan antes de copiarlos a evidencias; no se suben carpetas temporales ni Docker inspect.

Contrato OpenAPI **solo del escáner**, derivado de los endpoints reales, sin agregar Swagger ni rutas al backend:

| Rol de escaneo | Rutas activas |
|---|---|
| MEDICO | `GET /api/health`, `GET /api/beds`, `GET /api/triage/panel` (page/limit), `POST /api/patients/search`, `POST /api/triage/preview` |
| AUDITOR | `GET /api/audit/events` (action/limit) |

Se comprobaron 200 para MEDICO/panel y AUDITOR/auditoría, 403 de SERVICIOS para ambos módulos y 401 anónimo en camas. Cada escaneo generó **10 nuevas lecturas auditadas** en su handler autorizado: no se acepta un resultado basado solamente en 401. Una ejecución inicial detectó justamente ese fallo de autenticación por un filtro de host que incluía el puerto; la comprobación falló, se corrigió y se repitió. Los reportes entregados corresponden a la ejecución autenticada final.

No es un DAST exhaustivo: faltan fuzzing de registro/historial y transiciones de camas, autenticación activa del formulario de login, WebSocket, UI web, APK, TLS de despliegue y renovación de JWT durante escaneos largos. Esos flujos sí tienen pruebas funcionales/integración, que no sustituyen su DAST. Se limitan reglas a 1 min y escaneo activo a 5 min; ampliar esta política y el contrato exige nuevas evidencias. Los avisos informativos observados corresponden a respuestas 4xx esperables durante fuzzing, no se ocultaron.

## Hallazgos y decisiones

1. **Imagen bloqueada:** Trivy registra 224 hallazgos totales, de ellos 38 HIGH y 1 CRITICAL sin versión corregida indicada para los paquetes Debian afectados. Se retiraron npm/Yarn del runtime, reduciendo de 49 a 39 los hallazgos bloqueantes de la primera imagen evaluada. No se relajó el bloqueo ni se usó `--ignore-unfixed`. La imagen resultante sigue pendiente de revisión y actualización de base; no está aprobada para despliegue.
2. El CRITICAL es `CVE-2023-45853` asociado a `zlib1g`. El [tracker oficial de Debian](https://security-tracker.debian.org/tracker/CVE-2023-45853) indica que el código MiniZip afectado no se compila en los binarios zlib de bookworm. Esto justifica estudiar un posible falso positivo/VEX específico, **no afirmar explotación ni omitirlo automáticamente**. No se añadió excepción. Revisar los demás CVE y su alcance en un contenedor sin privilegios; evaluar una base mantenida más reciente y repetir todas las pruebas antes de autorizarla.
3. Dependencias: Trivy muestra `glob 13.0.6` y `minimatch 10.2.6` en API, y `minimatch 10.2.6` en frontend, severidad MEDIUM. Sus versiones corregidas implican cambios mayores de herramientas; quedaron documentados. `npm audit` frontend registra 14 avisos moderados, sin altos/críticos en la instalación final. npm y Trivy usan fuentes y agregaciones distintas; no se suman sus conteos.
4. El CLI de Ionic 7.2.1 añadido para ejecutar `ionic build` reproduciblemente incluía dependencias antiguas. Se fijaron overrides `tar 7.5.23`, `basic-ftp 6.2.6` y `tmp 0.2.7`. Se comprobaron instalación, build y pruebas. El salto mayor de tar en el CLI afecta herramientas de desarrollo; no se declaran probados todos los subcomandos de Ionic. Mantener esta excepción técnica de compatibilidad bajo revisión y retirarla cuando upstream publique una cadena corregida.
5. SAST: se hizo explícita la longitud GCM esperada, conservando el sobre v1. La regla SQL propia se ajustó a flujo de datos de entrada; las interpolaciones revisadas en panel/auditoría construyen fragmentos estáticos o columnas permitidas y pasan valores por parámetros. No se añadieron supresiones en código ni se declaró SQLi explotable en esas consultas.
6. Faltan evidencias **reales** de Actions, firma/verificación OIDC y bloqueo de PR. Los controles positivos locales no satisfacen por sí solos el requisito académico de mostrar un PR rechazado. No se introdujeron secretos o SQL vulnerable en main para esa demostración.

## Reproducir localmente

Requisitos: Docker Desktop operativo (Linux containers), Git, `rg`, Node **22.23.5** y acceso a registros oficiales para imágenes/advisories. No hacen falta credenciales de la API ni `.env`. Las herramientas no tienen que instalarse en el host: se ejecutan en contenedores fijados por digest.

Desde la raíz, PowerShell, usando el runtime ya disponible:

```powershell
$env:Path = (Resolve-Path 'apps/mobile/.tools/node-v22.23.5-win-x64').Path + ';' + $env:Path
# En otro equipo: instalar primero Node 22.23.5 y omitir esa línea.
npm.cmd ci --prefix apps/api
npm.cmd ci --prefix apps/mobile
# Primera ejecución de Playwright:
Push-Location apps/mobile
npx.cmd --no-install playwright install chromium
Pop-Location

node .ci/positive-controls.cjs
node .ci/security.cjs secrets
node .ci/run-tests.cjs
node .ci/security.cjs source
node .ci/security.cjs image
# El comando de imagen devuelve 1 mientras existan HIGH/CRITICAL.
# Puede evaluarse esa imagen con DAST aislado aunque esté bloqueada:
node .ci/dast.cjs
node .ci/report.cjs
```

Cada comando debe revisarse por su código de salida, sin encadenarlos para ocultar fallos. `run-tests.cjs` ejecuta `npm run test:cov` y `npm run build` en el backend. Para el frontend comprueba cobertura y lint, **`ionic build`** mediante el CLI local y Playwright. En Linux, Actions instala además dependencias del navegador con `playwright install --with-deps chromium`. Los resultados de cada fase quedan en `.reports/devsecops`, la imagen local en `.cache/devsecops/image/api.tar`. El archivo de imagen no se copia a la documentación ni se publica localmente.

**Precommit, en el repositorio Git real:** ejecutar `git config --local core.hooksPath .githooks` y en Linux `chmod +x .githooks/pre-commit`. Con Python/pre-commit instalado puede usarse alternativamente `pre-commit install` y `pre-commit run --all-files`, ambos con el mismo script. Elegir una modalidad de instalación. Docker y Node deben estar disponibles en el PATH del proceso Git. El scanner está fijado por digest, falla si no puede ejecutarse y examina staged; Actions examina además historial completo. No se instaló un hook en esta raíz exportada, que carece de `.git`. La ejecución del framework Python no se ha comprobado en este equipo; sí el hook Git nativo y el scanner compartido.

## Pipeline y revisión antes de publicar

PR/push a `main` ejecutan dos jobs: `quality` e `image-dast`. El segundo conserva el reporte DAST de evaluación aunque la imagen quede bloqueada; el job permanece fallido por el escaneo de imagen. Fallos de infraestructura, datos inválidos o escáneres no disponibles no se convierten en éxito. Los reportes tienen retención de 14 días y el archivo de imagen 1 día. Las versiones/digests fijan código de herramientas/base; no congelan los advisories de seguridad.

`publish-verify` solo se habilita por `workflow_dispatch` en main, con `publish_image=true` y ambos jobs satisfactorios. No existe publicación automática en push o PR. Descarga **el mismo archivo escaneado**, comprueba SHA-256 e identidad local, publica `ghcr.io/OWNER/REPO/api:COMMIT`, firma su digest, verifica issuer `https://token.actions.githubusercontent.com` e identidad exacta `https://github.com/OWNER/REPO/.github/workflows/mvp-ci.yml@refs/heads/main`, atestigua el SBOM y verifica la atestación. No usa una clave Cosign persistente. El consentimiento de Rekor/transparencia se limita a esa acción manual de publicación; no se ha ejecutado aquí.

Solo ese job recibe `packages: write` y `id-token: write`; el resto conserva `contents: read`. Checkout no conserva credenciales. Las imágenes y actions se fijan por digest/SHA, con límites de tiempo y concurrencia. No se utiliza `pull_request_target`. El token GitHub se pasa por stdin al login y se hace logout al terminar.

Antes de ejecutar el job de publicación deben configurarse en GitHub **revisores obligatorios** del environment `academic-delivery`, protección de main y checks requeridos para ambos jobs. El nombre de un environment en YAML **no configura por sí solo aprobación humana**. Verificar permisos GHCR/OIDC, disponibilidad de Actions fijadas y políticas de la organización. Con autorización posterior, obtener un run real y revisar sus artefactos; demostrar rechazo de identidad/digest incorrectos y PR bloqueado en ramas aisladas con datos sintéticos, sin mezclar pruebas vulnerables con main. No hay esas evidencias todavía.

## Archivos modificados

- Pipeline/controles: `.github/workflows/mvp-ci.yml`, `.pre-commit-config.yaml`, `.githooks/pre-commit`, `.gitignore`, `.gitleaks.toml`; `.ci/{lib,precommit,security,positive-controls,policy.test,run-tests,dast,dast-seed,publish,report}.cjs`, `.ci/tools.lock.json`, `.ci/rules/{owasp-javascript.json,sitcama.yml,README.md}`.
- API: `apps/api/Dockerfile`, `apps/api/src/patients/patient-data.service.ts`.
- Frontend/configuración de pruebas: `apps/mobile/package.json`, `package-lock.json`, `angular.json`, `playwright.config.ts`, `e2e/database.cjs`, `src/test-setup.ts` (SVG de iconos en jsdom); nuevos specs de `app.routes`, login, shell, api-errors y native-runtime; ampliación de specs API HTTP, registro y búsqueda.
- Documentación: este informe y `docs/evidence/devsecops/*` (inventario de reportes con SHA-256 en `manifest.json`).

Los 137 archivos protegidos del incremento visual anterior se compararon por hash: las diferencias corresponden a los cambios enumerados; los 24 archivos Android/Capacitor/entornos de esa referencia no cambian. `.env` no figuraba en aquella referencia; no se inventa un hash anterior. No hubo comandos de modificación de secretos o base existente. Compose y el servidor API/PostgreSQL de trabajo se conservaron; se reinició únicamente el servidor web 8100 para instalar dependencias bloqueadas por Sass, y se dejó operativo de nuevo. No se recompiló ni se hizo una nueva prueba manual del APK en este incremento.

Fuentes técnicas: [Gitleaks](https://github.com/gitleaks/gitleaks), [Semgrep CLI](https://semgrep.dev/docs/cli-reference), [Trivy filtering](https://trivy.dev/docs/latest/configuration/filtering/), [Syft](https://github.com/anchore/syft), [Sigstore CI](https://docs.sigstore.dev/quickstart/quickstart-ci/), [ZAP API scan](https://www.zaproxy.org/docs/docker/api-scan/), [ZAP header authentication](https://www.zaproxy.org/docs/getting-further/authentication/handling-auth-yourself/), [GitHub workflow reuse/anchors](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations).
