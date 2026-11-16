# Integración local del MVP SIT-CAMA

Fecha: 16 de noviembre de 2026. Rama: `feature/sit-cama-mvp-entrega-3`. HEAD conservado: `f66bcd7f608aef2f599cd12dfb3ac1c2a4c0043b`.

Se incorporó el MVP mediante una lista explícita de **277 archivos**, **2.074.952 bytes**, con SHA-256 verificado antes y después. [Manifiesto completo](integration/source-manifest.json). El origen no se modificó en sus archivos seleccionados. No se instalaron ni copiaron dependencias, runtimes o herramientas descargadas.

## Incorporados, modificados y preservados

| Grupo incorporado | Archivos |
| --- | ---: |
| Backend, configuración, SQL y pruebas | 64 |
| Frontend, configuración y E2E | 100 |
| Proyecto Android y Gradle Wrapper | 59 |
| Scripts `.ci` | 27 |
| Documentación original | 17 |
| Raíz, workflow y hook | 10 |

Se añadieron 15 evidencias revisadas y un resumen derivado del resultado API previo. Solo se copiaron cuatro capturas inspeccionadas. Se agregaron manifiestos, este informe, la explicación del workflow histórico y la propuesta del marcador sintético. `.gitignore` se amplió **antes** de copiar archivos; `README.md` identifica el MVP como aplicación principal.

Se conservaron exactamente `package.json`, `package-lock.json`, `Dockerfile`, `src/server.js` y `test/basico.test.js` originales. El lockfile vacío raíz del origen no se copió. El workflow anterior se archivó byte a byte en `docs/legacy-workflows/sign-image.yml.txt`; el archivo activo original se retiró del árbol de trabajo. [Comprobación de conservación](integration/preservation.json).

Los 277 archivos copiados, incluidos backend, frontend, Android, reglas clínicas, contratos, permisos, SQL, pruebas y controles, conservan los mismos bytes que el origen. `.ci/publication-review.json` permanece idéntico y con `status: blocked`. No se modificaron secretos, datos ni volúmenes PostgreSQL.

## Workflows y publicación

El único workflow activo es `.github/workflows/mvp-ci.yml`. El workflow Express histórico ya no puede publicar automáticamente al integrar en `main`: está fuera del directorio activo y conserva extensión `.txt`. El MVP mantiene publicación exclusivamente manual en `main`, dependiente de `quality` e `image-dast`, más la revisión de riesgos bloqueada.

No se hicieron commits, staging, merges, reinicialización Git, reset ni push. HEAD e índice permanecen intactos; el árbol queda deliberadamente con cambios pendientes para revisión. No se publicó ni firmó una nueva imagen SIT-CAMA.

## Comprobaciones ejecutadas ahora

| Control | Resultado |
| --- | --- |
| Copia explícita e integridad | 277/277 idénticos al origen |
| Actionlint 1.7.12 | Salida 0 |
| Sintaxis Node | 24 scripts, 0 errores |
| Referencias activas de CI y bases del Dockerfile | Existentes y coherentes con el lock |
| Pruebas de política y prueba histórica Express | 4/4 aprobadas |
| Gitleaks predeterminado, historial completo | Salida 0, 0 hallazgos |
| Gitleaks predeterminado, árbol actual | Salida 0, 0 hallazgos |
| Gitleaks con configuración histórica del experimento | **Salida 1, 1 hallazgo sintético; no aprobado** |
| Semgrep | 95 archivos analizados, 0 hallazgos |
| Trivy API | 2 MEDIUM, 0 HIGH/CRITICAL |
| Trivy frontend | 1 MEDIUM, 0 HIGH/CRITICAL |
| Trivy configuración | 1 LOW, 0 HIGH/CRITICAL |

El LOW `DS-0026` indica ausencia de HEALTHCHECK en el Dockerfile raíz histórico; no se alteró ese archivo. Los tres hallazgos MEDIUM permanecen visibles en el [registro de validación](integration/validation.json). No se relajaron umbrales ni se añadieron exclusiones.

Gitleaks utiliza la imagen fijada en `.ci/tools.lock.json`, repositorio de solo lectura y redacción del 100 %. El escaneo con la configuración histórica identificó la huella `aa7911a2796d70e8e9972ac5f125a7072cee6efe:src/config.js:sit-cama-demo-secret:1`. Se documenta como hallazgo del experimento, **sin excepción aplicada**; ver [propuesta específica](TRATAMIENTO-MARCADOR-GITLEAKS.md). Un escaneo aprobado con detectores predeterminados no sustituye ni convierte en aprobado el resultado fallido de la regla histórica.

No se ejecutó `positive-controls.cjs`, porque crea un repositorio desechable y ejecuta `git init`, `git add` y commits. Los scripts se preservaron sin cambios. Tampoco se reconstruyeron imágenes ni se repitieron suites de API/frontend/Android durante esta integración.

## Resultados API previos conservados

Se revisaron los JSON de la ejecución previa finalizada el **16/11/2026 a las 15:13:02 UTC**: **244/244 API**, **3/3** en la sonda original y respuesta **400** al intervalo invertido, sin lectura auditada adicional. Cobertura previa: sentencias **99,50 %**, ramas **92,77 %**, funciones **99,03 %**, líneas **100 %**, con el alcance y umbrales originales. [Resumen con hashes y procedencia](evidence/api-recheck-2026-11-16/summary.json).

Esos resultados no se atribuyen a una nueva ejecución en el destino. Los informes antiguos que describen Docker inaccesible o la regresión fallida se conservaron como evidencia de su momento y deben leerse junto con esta reejecución posterior.

## Exclusiones y límites

Se comprobaron muestras de secretos, variantes `.env`, cachés, reportes internos, APK, bases y salidas de compilación: están ignoradas. Permanecen incorporables `.env.example`, el SQL inicial y Gradle Wrapper. Las cachés y reportes generados por los controles están ignorados; no forman parte de la lista para staging. Las dependencias y herramientas locales del origen no se copiaron.

La evidencia pública es parcial y revisada; no se copiaron reportes con rutas personales ni capturas pendientes. Los archivos grandes generados y los reportes brutos permanecen fuera del contenido incorporable. El código Express histórico no queda cubierto por el SAST/SCA de aplicaciones del MVP; sus archivos e historial se preservaron. No se verificaron protecciones de rama ni una ejecución remota de Actions.

El MVP conserva sus limitaciones clínicas y funcionales documentadas; la integración no cierra las ocho HU ni aprueba automatización III–V o uso asistencial. La publicación de imagen continúa bloqueada.

## Revisión y primer commit propuestos

Los siguientes comandos son **propuestas para ejecutar después de la revisión**, no operaciones realizadas en esta integración. Se presupone que el contenido no cambió desde los manifiestos y que sigue la rama obligatoria.

```powershell
git status --short --branch --untracked-files=all
git diff --check
git diff -- .gitignore README.md .github/workflows/sign-image.yml
Get-Content docs/integration/source-manifest.json
Get-Content docs/integration/validation.json
Get-Content docs/integration/staging-paths.txt

# Solo después de aprobar la revisión:
git add --pathspec-from-file=docs/integration/staging-paths.txt
git update-index --chmod=+x -- apps/mobile/android/gradlew .githooks/pre-commit
git diff --cached --check
git diff --cached --stat
git diff --cached --find-renames
node .ci/precommit.cjs
git -c core.hooksPath=.githooks commit -m "feat: integrar MVP SIT-CAMA y preservar experimentos DevSecOps"
```

No se propone push, firma o publicación en esta fase. La instalación de hooks se debe coordinar con el equipo; copiar `.githooks/pre-commit` no modifica automáticamente la configuración local de Git.

La inspección final registra **304 archivos nuevos**, **2 modificados** (`README.md` y `.gitignore`) y **1 retirada del workflow activo**, conservado en su archivo histórico. No hay cambios staged. Los 311 archivos presentes incorporables, incluidos los originales preservados, no contienen archivos excluidos ni coincidencias con los secretos locales comparados. El archivo mayor es el SBOM histórico seleccionado, de 674.708 bytes. Los 946 archivos generados ignorados por Git son cachés/reportes de los controles y no forman parte de la lista propuesta para staging. `git diff --check` termina con salida 0; Git avisa de la normalización LF/CRLF prevista por su configuración local para los dos archivos modificados, sin cambiarla durante esta integración.
