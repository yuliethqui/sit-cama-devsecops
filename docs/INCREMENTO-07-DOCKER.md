# SIT-CAMA — Incremento 07: remediación Docker

Validación local: **14 de noviembre de 2026, America/Bogota**; reportes en UTC del 15 de noviembre.

**Los 39 hallazgos bloqueantes originales desaparecen del escaneo de la nueva imagen. La publicación sigue bloqueada** por una revisión independiente de zlib embebida en Node. No se declara la imagen «segura» ni se publicó en GitHub/GHCR. El contenedor funcional de desarrollo continúa ejecutando su imagen anterior.

La [matriz completa](evidence/incremento-07/comparison.md), el [detalle de los 39 pares paquete–CVE](evidence/incremento-07/blocking-before-after.csv) y los [reportes con SHA-256](evidence/incremento-07/manifest.json) permiten comprobar los resultados. Se conserva intacta la evidencia original de [Entrega 3](DEVSECOPS-ENTREGA-3.md).

## Comparación comprobada

Las tres imágenes se examinaron con Trivy 0.76.2 fijado por digest y **la misma base de advisories**, actualizada el 14/11 a las 19:00 UTC, descargada el 15/11 a las 01:31 UTC. El hash y metadatos de esa base están en `summary.json`. No se usó `--ignore-unfixed`, VEX, ignorelists ni ajustes de severidad.

| Imagen | CRITICAL | HIGH | MEDIUM | LOW | UNKNOWN | Total | Paquetes Debian | Componentes SBOM |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Bookworm original, reescaneada | 1 | 38 | 95 | 85 | 5 | 224 | 88 | 3469 |
| Node 22.23.5 Trixie slim | 0 | 48 | 85 | 64 | 5 | 202 | 79 | 2921 |
| Distroless + Node oficial, seleccionada | 0 | 0 | 39 | 12 | 2 | 53 | 14 | 1681 |

El escaneo de la imagen construida desde el Dockerfile final repite los números de la candidata Distroless. Sus 53 avisos restantes **no son un resultado sin vulnerabilidades**. Los 39 originales son 12 CVE distintos distribuidos entre 21 paquetes; la severidad se cuenta por par paquete–CVE.

| CVE original | Severidad | Pares | Familia/paquetes | Aplicabilidad revisada y resultado |
|---|---|---:|---|---|
| CVE-2026-53613 | HIGH | 8 | util-linux y bibliotecas | Carrera local en mount/fstab privilegiado; la aplicación no ejecuta mount. Paquetes ausentes en runtime final. |
| CVE-2026-53615 | HIGH | 8 | util-linux/libblkid y derivados | Análisis de particiones manipuladas; el backend no sondea discos. Paquetes ausentes. |
| CVE-2026-78410 | HIGH | 8 | util-linux y derivados | Bind mount privilegiado con origen mutable; paquetes ausentes. |
| CVE-2026-41992 | HIGH | 1 | gzip 1.12-1 | Ejecutable GNU gzip con LZW/LZH; no equivale al stream zlib de Node. Ejecutable ausente. |
| CVE-2026-54369 | HIGH | 1 | libacl1 2.3.1-3 | Operaciones ACL privilegiadas con symlinks; sin llamadas identificadas en la aplicación. Paquete ausente. |
| CVE-2025-6020 | HIGH | 4 | PAM 1.5.2-6+deb12u2 | pam_namespace; el login usa JWT/argon2. PAM ausente. |
| CVE-2026-16742 | HIGH | 2 | libsystemd0/libudev1 | Aviso asociado a systemd-homed; no se afirmó explotabilidad de todas las bibliotecas. Paquetes ausentes. |
| CVE-2025-69720 | HIGH | 3 | ncurses/libtinfo 6.4-4 | Parser de infocmp; herramienta y paquetes ausentes. |
| CVE-2026-9538 | HIGH | 1 | perl-base 5.36.0-7+deb12u4 | El aviso afecta Archive::Tar; no se comprobó que ese módulo estuviera en la original. No se invoca Perl y el paquete se elimina al cambiar de base. |
| CVE-2023-45853 | CRITICAL | 1 | zlib1g 1:1.2.13.dfsg-1 | MiniZip no encontrado en binarios pertinentes; propuesta VEX específica, sin aplicar. Paquete Debian final actualizado. |
| CVE-2026-76844 | HIGH | 1 | zlib1g | La descripción del aviso habla de webpack-dev-middleware, pero Debian lo asocia a zlib. Discrepancia conservada para revisión; no se ocultó. Versión Debian final corregida según el tracker. |
| CVE-2026-85091 | HIGH | 1 | zlib1g | Biblioteca Debian final corregida; revisar por separado las funciones gz* incluidas dentro del binario Node. |

El CSV/JSON registra por cada uno de los 39 pares: paquete, versión instalada, severidad original, estado, corrección indicada, versión final y aplicabilidad. El informe original no indicaba versión corregida para Bookworm. En Trixie, APT sí ofrecía `zlib1g=1:1.3.dfsg+really1.3.1-1+deb13u1`; no se presenta un resultado hipotético de actualización como escaneo ejecutado.

## Selección de base y compatibilidad

Se evaluó primero **la imagen oficial** `node:22.23.5-trixie-slim`, con digest `sha256:68c76cfad89921b927eae28ba21407475e29d0ce450afcdbe70c1532db042b64`. Aunque corrige varios avisos de Bookworm, introduce otros de util-linux/login/SQLite y acumula 48 bloqueantes. No se seleccionó como runtime final.

El Dockerfile seleccionado tiene cuatro etapas: compilación con Node oficial Trixie, `verify` con dependencias de pruebas, instalación de dependencias de producción sobre esa misma base y runtime mínimo:

```text
Node/build: node:22.23.5-trixie-slim
sha256:68c76cfad89921b927eae28ba21407475e29d0ce450afcdbe70c1532db042b64

Runtime: gcr.io/distroless/cc-debian13:nonroot
sha256:cb87acc574abe719b6e5c547384defa2f7b1f24af9605d3f618cf852495d8be2
```

El runtime final **no es una imagen Node publicada por nodejs**: combina Debian 13 Distroless de Google con el binario sin modificar de la imagen oficial Node. Se conserva la licencia de Node. La firma pública de esa base Distroless se verificó realmente con Cosign 3.1.4, issuer `https://accounts.google.com` e identidad exacta `keyless@distroless.iam.gserviceaccount.com`. Esto **no es una firma de SIT-CAMA** ni una ejecución de GitHub Actions.

La imagen final local es `sitcama-api:inc07-final`, ID `sha256:e61fa809670bbd0892d293612d647f7b9cb45a10bcfed169b1000b4995db6493`; archivo Docker SHA-256 `0ae2712e1f1dab54995d093066b707380ebcbd75f79e3244b2a2f18556669ebd`. Los digests de las bases, Dockerfile y herramientas se conservan en el lock y las evidencias. Reconstrucciones posteriores pueden cambiar el índice/provenance o fechas: verificar sus nuevos hashes, no reutilizar esta identidad sin comprobarla.

No se migró a Alpine/musl ni se forzó la eliminación de paquetes esenciales con APT. Se eligió una base mínima mantenida que aporta glibc, libstdc++, libgcc, certificados, zonas horarias y bibliotecas necesarias. La diferencia entre 88 y 14 paquetes se respalda con inventarios reales, no borrando metadatos de paquetes para engañar al escáner.

Comprobaciones de compatibilidad:

- Node **v22.23.5**, argon2 **0.41.1**; glibc pasa de 2.36 a 2.41. Se inspeccionaron los ELF cargados y se ejecutó el binding `argon2.glibc.node`.
- Hashes Argon2, contraseñas incorrectas, cifrado AES-GCM v1 y HMAC de documento se validaron **en ambas direcciones entre imagen vieja y nueva**, con claves y casos sintéticos generados en memoria. No se leyeron claves o identidades reales para esa prueba.
- Se conserva UID/GID **10001:10001**. El runtime funcionó con raíz de filesystem de solo lectura, `/tmp` efímero, sin capabilities y con `no-new-privileges`.
- `HEALTHCHECK` usa forma exec, ya que no hay shell. El healthcheck de Compose existente ya usaba exec y no se modificó.
- No hay shell, npm, gestores de paquetes ni herramientas de administración en la imagen final. Diagnósticos con `docker exec ... sh` no funcionarán: usar Node o una imagen de herramientas separada. La etapa `verify` no se despliega.

Se validó **Linux amd64** en Docker Desktop. No se declaran probadas otras arquitecturas solo porque los digests admitan múltiples plataformas. No se recompiló Android ni se repitió su prueba manual: sus archivos y los del frontend permanecen iguales.

## CVE-2023-45853 y VEX

El [tracker oficial de Debian](https://security-tracker.debian.org/tracker/CVE-2023-45853) aclara que MiniZip de contrib no se compila en los binarios zlib de Bookworm. Se contrastó con la imagen original, no solamente con la descripción del aviso:

- Sin paquete MiniZip/pyminizip en el inventario consultado.
- `libz.so.1.2.13` tiene tabla de símbolos analizable, sin `zipOpenNewFileInZip4_64`.
- Tampoco aparece esa función en Node, argon2 o los ELF cargados inspeccionados. Node conserva tablas de símbolos extensas; no se dedujo ausencia simplemente de un binario opaco sin símbolos.
- No se identificaron llamadas MiniZip en los flujos de SIT-CAMA. La copia zlib reportada por Node es 1.3.1-e00f703, distinta de `zlib1g` del sistema.

Se dejó [una propuesta OpenVEX](evidence/incremento-07/vex-proposal-bookworm.json) **sin firma y no aplicada**, limitada a CVE-2023-45853, al paquete Debian y al digest exacto de la imagen original. Propone `not_affected / vulnerable_code_not_present`, fundamentado en los hechos anteriores. No declara segura la imagen completa, no cubre otros CVE y no se utiliza para obtener el resultado verde. La remediación seleccionada no necesita esa excepción.

## Riesgo pendiente que impide publicar

El runtime final actualiza la biblioteca Debian `zlib1g` a la versión corregida, pero **copiar Node también copia sus dependencias estáticas**. El análisis ELF detectó `gzwrite`, `gz_write`, `gzfwrite` y `gzclearerr` dentro de Node. El [código de gzwrite en Node v22.23.5](https://raw.githubusercontent.com/nodejs/node/v22.23.5/deps/zlib/gzwrite.c) conserva una ruta de retorno de error que debe contrastarse con la [corrección upstream de CVE-2026-85091](https://github.com/madler/zlib/commit/df84af25dc1942490e1d1c899a07619152a46148.patch). La [descripción de Debian](https://security-tracker.debian.org/tracker/CVE-2026-85091) explica las condiciones de fallo de escritura y llamadas gz* posteriores.

El [binding JavaScript zlib de Node](https://raw.githubusercontent.com/nodejs/node/v22.23.5/src/node_zlib.cc) emplea deflate/inflate; no se encontró una llamada gzwrite/gzclearerr desde ese binding, la aplicación o el addon cargado. **Esto no establece explotación remota ni una prueba universal de no alcanzabilidad.** La discrepancia del aviso CVE-2026-76844 exige igualmente una evaluación precisa. No se confirmó un defecto explotable de SIT-CAMA ni se aplicó un VEX automático a estas copias.

Por ello `.ci/publication-review.json` mantiene `status: blocked`, con alcance a los dos digests elegidos y una revisión `under_investigation`. `.ci/publish.cjs` lo comprueba **antes de contactar con el registro**, incluso si Trivy no devuelve HIGH/CRITICAL. El test de esa política comprueba rechazo con riesgos pendientes y con digests distintos; este control adicional no permite saltarse el bloqueo normal de Trivy.

Recomendación: **no desbloquear publicación todavía**. Obtener una evaluación de alcanzabilidad revisada de la copia embebida o una actualización oficial de Node 22 que resuelva el código aplicable; repetir escaneos, compatibilidad y DAST si cambia el binario. Conservar también seguimiento de los 39 MEDIUM, 12 LOW y 2 UNKNOWN del escaneo final. El cero de Trivy satisface su umbral configurado; no sustituye esa revisión.

## Pruebas y conservación

Se ejecutó la suite vigente completa en la etapa Linux `verify`, sobre PostgreSQL 17 aislado en una red interna y tmpfs: **168/168 pruebas, 13 suites**, con cobertura:

| Statements | Branches | Functions | Lines |
|---:|---:|---:|---:|
| 99.49 % | 92.44 % | 99.03 % | 100 % |

Incluye autorizaciones, transacciones, concurrencia, rollback de auditoría, Socket.IO y consultas. La primera ejecución falló porque el test de camas leía obligatoriamente `/.env`. Se hizo esa lectura opcional, manteniendo `TEST_PG*`, igual que los otros harnesses; se repitió con éxito. No se cambiaron las expectativas de negocio ni código de las HU.

Además, contra **el contenedor runtime final real** se comprobaron login de tres roles, registro ficticio con triaje I, búsqueda limitada, 38 camas, asignación, conflictos 409 de cama/paciente, liberación, limpieza, panel, consulta de auditoría y denegación clínica a SERVICIOS. El healthcheck Docker llegó a healthy. `npm run build` también pasó en el host; la compilación de las etapas Docker pasó durante las construcciones.

Al cambiar la imagen final se repitió ZAP aislado. Resultados: **0 alertas medias/altas**, una informativa por rol; 10 lecturas auditadas autenticadas en cada escaneo. Alcance: las mismas seis rutas de Entrega 3, sin presentar un DAST completo de toda la aplicación ni del APK. Las pruebas generaron y eliminaron únicamente sus bases/contenedores temporales.

Se compararon 204 archivos protegidos: solo cambia el fallback de `.env` del test de camas. El hash del `.env` real permanece igual. Conteos y fingerprints de las seis tablas originales coinciden antes/después, incluidas las 38 camas; IDs, imágenes y fechas de inicio de los contenedores de trabajo tampoco cambiaron. Véase [preservation.json](evidence/incremento-07/preservation.json). No se borraron pacientes, tablas o volúmenes ni se alteraron secretos, roles, endpoints, DTO o la interfaz.

## Archivos y CI

- `apps/api/Dockerfile`: nuevo runtime mínimo y etapa `verify`.
- `apps/api/test/beds.integration.spec.ts`: lectura opcional del archivo local de entorno, sin cambiar casos funcionales.
- `.ci/tools.lock.json`: bases por digest.
- `.ci/lib.cjs`, `.ci/security.cjs`: directorios separados de evidencia/cache, Dockerfile de candidata y modo `image-existing`; se conserva la política HIGH/CRITICAL y se comprueba consistencia del lock.
- `.ci/docker/Dockerfile.{bookworm,trixie,distroless}`: recetas reproducibles de las candidatas, sin desplegarlas.
- `.ci/runtime-audit.cjs`, `runtime-hash-fixture.cjs`, `cross-runtime.cjs`, `verify-runtime.cjs`: inspección ELF, compatibilidad y suite aislada.
- `.ci/verify-base.cjs`: verificación pública de la firma de la base.
- `.ci/publication-review.json`, `release-policy.cjs`, `publish.cjs`, `policy.test.cjs`: bloqueo de publicación por revisión pendiente, sin excepciones a Trivy.
- `.github/workflows/mvp-ci.yml`: se amplía el único workflow con verificación de base y suite Linux/runtime. Se mantienen permisos mínimos y publicación manual; no se ejecutó en GitHub.
- `.ci/remediation-report.cjs`, este informe y `docs/evidence/incremento-07/*`: tablas, JSON, SBOM, DAST y manifest verificable.

Los artefactos incluyen CycloneDX 1.7 de la imagen final, reportes Trivy originales de cada perfil, auditoría de runtime, prueba de compatibilidad, suite Linux y firma pública de la base. No incluyen archivos de imagen, claves temporales ni sesiones JWT.

## Repetir sin reemplazar el entorno de desarrollo

Requisitos: Docker Linux, Node 22.23.5, Git, `rg` y Cosign 3.1.4 para verificar la base. El Cosign local se descargó desde su release oficial y se contrastó con sus checksums. No hacen falta credenciales o claves del proyecto.

```powershell
# Desde la raíz; este runtime ya está disponible en este equipo.
$env:Path = (Resolve-Path 'apps/mobile/.tools/node-v22.23.5-win-x64').Path + ';' + $env:Path
$env:Path = (Resolve-Path '.cache/incremento-07/cosign').Path + ';' + $env:Path
$env:SITCAMA_REPORT_DIR = '.reports/incremento-07/final'
$env:SITCAMA_CACHE_DIR = '.cache/incremento-07/final'
$env:SITCAMA_TRIVY_CACHE_DIR = '.cache/incremento-07/trixie/trivy'
$env:SITCAMA_CI_IMAGE = 'sitcama-api:inc07-final'

node .ci/verify-base.cjs
node .ci/security.cjs image
docker build --pull --target verify -t sitcama-api:inc07-verify -f apps/api/Dockerfile apps/api
node .ci/verify-runtime.cjs
node .ci/cross-runtime.cjs
node .ci/dast.cjs
node --test .ci/policy.test.cjs
```

Revisar el código de salida de cada comando. En otros equipos instalar Cosign/Node, sin asumir que existe `.cache` o `.tools`. Para reconstruir una candidata usar `SITCAMA_DOCKERFILE=.ci/docker/Dockerfile.trixie` (o `.bookworm`), otro tag y otros directorios de resultados/cache. Para reescanear una imagen local sin reconstruirla usar `image-existing`. Compartir la caché Trivy permite comparar con la misma base mientras no se actualice; conservar su hash/fecha, ya que los resultados pueden variar con nuevos advisories.

La recolección `node .ci/remediation-report.cjs` usa los perfiles y snapshots de esta evaluación local. No debe inventarse un snapshot anterior en otra máquina: capturarlo primero o conservar esta evidencia histórica sin regenerarla. Nunca ejecutar `docker compose up --build` para esta evaluación: los scripts crean entornos independientes. El despliegue y cualquier publicación requieren revisión posterior y no se realizaron aquí.
