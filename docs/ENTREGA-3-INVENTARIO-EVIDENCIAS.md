# ENTREGA 3 — INVENTARIO DE EVIDENCIAS

**Repositorio local:** C:\Users\Usuario\Downloads\SIT-CAMA-github

**Rama:** feature/sit-cama-mvp-entrega-3

**HEAD del cierre y de la nueva compilación Android:** 284afeb0d62d8ab59665a2944327b224704321f9

**Commit de los ZIP históricos del pipeline:** 50d7c0cdc39332a7b9e1837476f3c3060d78ae4f. El último HEAD 284afeb se comprobó por separado: [run 43995126035](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43995126035), completed / success, Quality e Image/DAST success y publicación skipped. No se atribuyen al último commit los ZIP ni porcentajes del run anterior.

**Corte:** 16/11/2026, hora de Bogotá. Las verificaciones posteriores a 00:00 UTC del 17/11 corresponden todavía al 16/11 en Bogotá.

Complementa el [informe final](ENTREGA-3-INFORME-FINAL.md). Todos los hashes son SHA-256 sobre los bytes reales. Las rutas relativas parten de la raíz indicada. **.reports está ignorado por Git**: sus anexos deben adjuntarse manualmente; los enlaces locales no los publican en GitHub.

## 1. Fuente oficial y alcance

Documento recibido: **C:\Users\Usuario\Downloads\Guia-Entrega-3-SIT-CAMA-v3.pdf**, 4.383.973 bytes, 13 páginas.

**SHA-256:** 0d2329ef229f0c60f5eba6bef46d89104fe302fa56fbe0fe06df2676ee615d75.

Procedencia y metadatos: .reports/final-entrega-3/guide-provenance.json. Se leyó el PDF original y se comprobaron visualmente las páginas de experimentos, cuestionario y rúbrica. Las páginas 10–11 definen los cuatro experimentos; 11–12 contienen las cinco preguntas; 13 contiene las cinco dimensiones y pesos 20/20/25/20/15. El nombre recibido identifica la versión v3; el encabezado interno dice «Taller ALM VERSIÓN 1.0».

Los extractos y renders locales son ayudas de lectura, no evidencia de implementación. **No se incluyen en los ZIP entregables**: la guía contiene ejemplos literales de credenciales académicas que no se replican en los anexos públicos.

## 2. ZIP comprobados para adjuntar

Se verificaron los **314 miembros de seis ZIP**, sin errores de CRC/descompresión. En los cuatro paquetes de experimentos se comprobaron todos los hashes del manifiesto y la ausencia de miembros adicionales, excluido el manifiesto de su propia lista. Los dos paquetes Actions coinciden exactamente con el digest de GitHub; se calculó además el hash de cada miembro en archive-review.json.

| ID | Ruta exacta | Bytes / archivos | SHA-256 |
|---|---|---:|---|
| A1 | [.reports/final-entrega-3/annexes/experimento-1-evidencias-revisadas.zip](../.reports/final-entrega-3/annexes/experimento-1-evidencias-revisadas.zip) | 2795 / 7 | 8bd745f785ab615ab5cff28a168bba84625d6c8c6271e1e858bab209b129968e |
| A2 | [.reports/experiment-2/experimento-2-evidencias.zip](../.reports/experiment-2/experimento-2-evidencias.zip) | 21854 / 22 | ee79a62932b6652c411fc48116d6451fee28e8ea127f97131bf26ad0d3495b0b |
| A3 | [.reports/experiment-3/experimento-3-evidencias.zip](../.reports/experiment-3/experimento-3-evidencias.zip) | 30370 / 30 | 3404aa3907bd095fe073e33aabeb506fd4a23eec4be188b816e4d1f11c2ba317 |
| A4 | [.reports/experiment-4/experimento-4-evidencias.zip](../.reports/experiment-4/experimento-4-evidencias.zip) | 31608 / 27 | 8656229228d895cbf695434ec44db5c828449688c90fa614fcbb442374150345 |
| A5 | [.reports/final-entrega-3/github-artifacts/image-security-reports.zip](../.reports/final-entrega-3/github-artifacts/image-security-reports.zip) | 371714 / 66 | b578f235bbf99bb1ba32b6b9bbad82d750d35f9f94760cc79d24a56405bab9e6 |
| A6 | [.reports/final-entrega-3/github-artifacts/quality-reports.zip](../.reports/final-entrega-3/github-artifacts/quality-reports.zip) | 1104637 / 162 | 939495b627807b2d9187e6267325bca596843e00b47bde04076b2a082faf7b27 |

**A1 es una selección derivada creada para este informe**, de seis registros originales redactados y un manifiesto. Conserva las fechas y hashes de origen. Excluye el marcador sintético, el índice Git respaldado y el archivo de restauración privado. A2–A4 son los ZIP originales de los experimentos: no se reescribieron. A5–A6 son los ZIP originales descargados de Actions, sin modificación.

Completitud significa **completos respecto a su selección declarada**, no una copia de todo .reports ni de las bases de vulnerabilidades.

La revisión de miembros buscó JWT completos, PAT, claves privadas y asignaciones explícitas de contraseñas/Authorization; no obtuvo coincidencias. Se contrastó además la procedencia sintética y se inspeccionaron las cuatro capturas web usadas. Esta actualización añade la inspección de dos capturas ALM, conservadas fuera de los seis ZIP originales. Los certificados públicos de Cosign y sus firmas son evidencia pública, no claves privadas. Los seis ZIP no incluyen .env, bases clínicas, node_modules, APK, herramientas descargadas, caches ni índices Git. El paquete externo sí incorpora por separado los dos APK debug expresamente verificados y autorizados. Este resultado describe los archivos seleccionados y no certifica todo el disco.

Registro detallado: **.reports/final-entrega-3/archive-review.json**. Su lista contiene ruta, tamaño y SHA-256 de cada miembro de los seis ZIP.

## 3. Reportes de GitHub Actions y enlaces verificables

[Run aprobado 43924092624](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43924092624), workflow **.github/workflows/mvp-ci.yml**, HEAD 50d7c0c, evento de PR:

| Evidencia | Enlace / identificación | Resultado |
|---|---|---|
| Quality | [Job 133498820735](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43924092624/job/133498820735) | success |
| Image/DAST | [Job 133498821235](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43924092624/job/133498821235) | success |
| Publicación | [Job 133501404696](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43924092624/job/133501404696) | skipped; no firma MVP |
| A5 image-security-reports | [Artefacto 14256235099](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43924092624/artifacts/14256235099) | 371.714 bytes, 66 archivos; expira 30/11/2026 18:02:10 UTC |
| A6 quality-reports | [Artefacto 14254828557](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43924092624/artifacts/14254828557) | 1.104.637 bytes, 162 archivos; expira 30/11/2026 18:03:33 UTC |
| Imagen archivada scanned-image | [Artefacto 14255805698](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43924092624/artifacts/14255805698) | 64.460.117 bytes; no descargado, expira 17/11/2026 18:02:11 UTC |

El digest declarado para scanned-image es **606212607498a05f4f65ed7b89f252adc185d67d6c39e329173e08f1eba5612f**: es metadato remoto **no comprobado contra descarga local**. No debe confundirse con el imageId Docker ni con un digest de manifest OCI publicado.

Los reportes A5–A6 sí están descargados y verificados; no requieren volver a obtenerse antes de adjuntarlos. Los enlaces de descarga de GitHub pueden requerir autenticación y tienen caducidad. No se guardaron URLs temporales de descarga ni credenciales en los anexos.

Los archivos quality-approved-excerpt.log e image-dast-approved-excerpt.log son **extractos seleccionados**, con procedencia y timestamps originales, no registros completos. verified-results.json deriva sus datos de los ZIP originales, no de una ejecución nueva.

## 4. Correspondencia de evidencia y alcance

| Tema | Archivo de consulta principal | Qué demuestra / qué no demuestra |
|---|---|---|
| E1 local | .reports/experiment-1/result.json y A1 | Hook y staged 1; ningún commit creado. No demuestra PR bloqueado. |
| E1 control positivo en CI | A6: .reports/devsecops/positive-controls.json | Pruebas esperadas dentro de Actions; orquestador success. No PR vulnerable. |
| E2 | A2: summary.json, matrix.json, ci-overlay.json y fixtures/ | Regla ERROR y rechazo local selectivo; no código vulnerable integrado ni PR actual bloqueado. |
| E3 | A3: summary.json, reportes Trivy, gates y metadatos DB | HIGH en 8.5.1, scanner 0/gate 1, control 9.0.3 gate 0; no bloqueo remoto de PR. |
| E4 | A4: base/, history/, publication-block.json y zlib-review.json | Firmas Distroless/Express válidas y política blocked rechazada. No firma de backend MVP. |
| Pruebas API | A6: .reports/devsecops/api-tests.json; A5: linux/api-tests.json | Dos ejecuciones de las mismas 244 pruebas; no 488 casos diferentes. |
| Cobertura | A5: linux/coverage/lcov-report/index.html; A6: apps/api/coverage/ y apps/mobile/coverage/ | Cuatro métricas superan 80% en el alcance instrumentado. |
| Frontend y E2E | A6: frontend-tests.json, e2e-tests.json bajo .reports/devsecops/ | 105 unitarias y 43 E2E aprobadas; no cobertura Android nativa. |
| DAST | A5: dast.json y zap-medico/auditor.html/json | Informes, acceso autenticado y sondas RBAC; contrato parcial, no cobertura total de API. |
| SBOM/runtime | A5: image.json, sbom.cdx.json, trivy-image-gate.json, runtime-verification.json | 1681 componentes, cero bloqueantes, runtime no root probado; publicación sigue bloqueada. |
| ALM | Consultas históricas github-issue-12.json a github-issue-19.json, github-pr11.json y github-reviews.json; nueva inspección projects-review.json y dos capturas en docs/evidence/entrega-3/ | Tablero_Kanban configurado con las ocho HU, campos y estados comprobados por capturas. Cuatro In Progress, cuatro Security Review y cero Done. Siguen pendientes revisión por pares, aceptación PO y trazabilidad histórica estricta. |
| MVP web | docs/evidence/tema-azul/360/, cuatro PNG inspeccionados | Demostración web sintética de 14/11; no capturas Android. |
| Android | Paquete externo: android/app-debug.apk, android/app-debug-284afeb.apk, android/inicio-medico.png y android/VERIFICACION-ANDROID.json | APK histórico identificado sin atribución al HEAD; APK nuevo compilado desde 284afeb, instalado con hash coincidente y login MEDICO manual confirmado con captura. No acredita release ni validación integral de HU. |

La carpeta manual **.reports/experimento-1/** contiene otro positive-controls.json, timestamp 22:19:36 UTC. Se conserva, pero el informe utiliza el original de **A6, timestamp 18:01:49 UTC**, para atribuir la ejecución al pipeline aprobado. Los nombres similares no hacen intercambiables sus procedencias.

Históricos útiles: [PR #8](https://github.com/yuliethqui/sit-cama-devsecops/pull/8) y [run 42743048872](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/42743048872) para Express/Semgrep anterior; [PR #10](https://github.com/yuliethqui/sit-cama-devsecops/pull/10) y [run 42752729344](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/42752729344) para firma Express. No sustituyen evidencias del MVP.

### Actualización ALM: GitHub Projects

El proyecto **Tablero_Kanban**, vista **Planificación SIT-CAMA**, está configurado con las ocho HU #12–#19. Las dos capturas originales de docs/evidence/entrega-3/ fueron inspeccionadas visualmente; muestran los campos **Épica, Sprint, Prioridad, Story Points y Status** y estos valores:

| HU / Issue | Épica | Sprint | Prioridad | Story Points | Status |
|---|---|---|---|---:|---|
| HU-01 / #12 | EP-01 | Sprint 1 | Must Have | 5 | In Progress |
| HU-02 / #13 | EP-01 | Sprint 1 | Must Have | 3 | Security Review |
| HU-03 / #14 | EP-01 | Sprint 1 | Should Have | 2 | In Progress |
| HU-04 / #15 | EP-02 | Sprint 2 | Must Have | 5 | Security Review |
| HU-05 / #16 | EP-02 | Sprint 2 | Must Have | 3 | Security Review |
| HU-06 / #17 | EP-02 | Sprint 2 | Should Have | 3 | In Progress |
| HU-07 / #18 | EP-03 | Sprint 1 | Must Have | 3 | Security Review |
| HU-08 / #19 | EP-03 | Sprint 2 | Must Have | 3 | In Progress |

Totales de las ocho HU: **tres épicas, dos sprints, seis Must Have, dos Should Have y 27 Story Points**. Hay cuatro In Progress y cuatro Security Review; **ninguna está en Done**. Las seis tarjetas históricas adicionales en Backlog no se incluyen en esos totales. Security Review no equivale a revisión por pares aprobada ni a aceptación del Product Owner.

**URL directa:** no verificada. Las capturas no contienen la barra de direcciones; el acceso al navegador se detuvo por no poder determinar con confianza su URL y la búsqueda pública no devolvió un enlace comprobable. Se documenta la configuración acreditada por las capturas sin inventar una dirección.

La fecha exacta de toma de las capturas no está acreditada; la inspección documental es del 16/11/2026, hora de Bogotá. Se conservan los nombres originales con doble extensión .png.png. No muestran credenciales, JWT ni datos clínicos. Su inspección no cambia el alcance de los escaneos ni de las pruebas históricas. Procedencia, hashes, valores transcritos y consulta actual del PR: **.reports/final-entrega-3/projects-review.json**.

**Pendientes ALM:** revisión por pares, aceptación del Product Owner y trazabilidad histórica estricta. Configurar el tablero no completa la DoD de las HU.

## 5. Catálogo de archivos esenciales y hashes

El catálogo completo de estos archivos está en **.reports/final-entrega-3/evidence-catalog.json**. Los hashes siguientes identifican los bytes revisados; la ruta enlazada es relativa a la raíz del repositorio.

| Archivo exacto | Bytes | SHA-256 |
|---|---:|---|
| [.reports/final-entrega-3/guide-provenance.json](../.reports/final-entrega-3/guide-provenance.json) | 431 | 6fed8b4c0452a0cf67aaa0b84f5cdb14197925df907030dc9aee8c34ba9b53c8 |
| [.ci/publication-review.json](../.ci/publication-review.json) | 956 | 40a0e9871c2e040a63f35738785e0e6717b653f842d19c2ea15f18f1ce826265 |
| [.reports/experiment-1/result.json](../.reports/experiment-1/result.json) | 1026 | b0c4d8f92af68abcd592dbc5cb93728ff3dc11a2a411a268f1c554118380d838 |
| [.reports/experiment-2/export-reviewed/summary.json](../.reports/experiment-2/export-reviewed/summary.json) | 8225 | e6ef7af42701f2208d440f72518943d5526a5630c8753008570b83d1eaaff0b8 |
| [.reports/experiment-3/export-reviewed/summary.json](../.reports/experiment-3/export-reviewed/summary.json) | 10451 | 163eb42d415576e63bb74521d800619c973c88eedf6418a5e317e6eabc893228 |
| [.reports/experiment-4/export-reviewed/summary.json](../.reports/experiment-4/export-reviewed/summary.json) | 7323 | 4b993c877cac809bd0c65a6bf66bf586562954cd848e6048b3ade671d836da73 |
| [.reports/experiment-4/export-reviewed/zlib-review.json](../.reports/experiment-4/export-reviewed/zlib-review.json) | 2678 | ba82050fd9c195973ffeede62e77b6299aac02a0f116812a4422b855df8e6bd5 |
| [.reports/final-entrega-3/archive-review.json](../.reports/final-entrega-3/archive-review.json) | 66856 | 5d8a47306ff2ff97f88f3d40ca1e2b51271de52d7237b554378b40fd174c249a |
| [.reports/final-entrega-3/verified-results.json](../.reports/final-entrega-3/verified-results.json) | 9628 | 33f8006bd16aee09692867232ef302a75722a6a2169940c811f071aedc114984 |
| [.reports/final-entrega-3/github-run-approved.json](../.reports/final-entrega-3/github-run-approved.json) | 1594 | c03e450b1062edb05b3d3265bf19dbd525463cbc7c0902503830f695f4a9b73e |
| [.reports/final-entrega-3/github-jobs.json](../.reports/final-entrega-3/github-jobs.json) | 11708 | 9c5379281165208a0f3bb71dec1b217c0db2f73aedace3a2a374b0eff35647d2 |
| [.reports/final-entrega-3/github-artifacts.json](../.reports/final-entrega-3/github-artifacts.json) | 2545 | 7dcc655fa5cda3557dad2e0418275674313143c3b986e1ad03635227febbabb8 |
| [.reports/final-entrega-3/github-pr11.json](../.reports/final-entrega-3/github-pr11.json) | 21120 | c5a75351d5ee6e871ac2d7e3a059dfd0b57b9bfb7cb9108900d6f33ee241e9c5 |
| [.reports/final-entrega-3/github-reviews.json](../.reports/final-entrega-3/github-reviews.json) | 19 | ccd46cae0f15145482d58614707f7d6baa2e31e97f31c7fc781a91097be84097 |
| [.reports/final-entrega-3/github-issue-12.json](../.reports/final-entrega-3/github-issue-12.json) | 6171 | 295e898a930b37b33e37e894fee5f745b69cfa6e3d9789712b40f0050f9137c2 |
| [.reports/final-entrega-3/github-issue-13.json](../.reports/final-entrega-3/github-issue-13.json) | 4865 | 10b6f1d5bb89522786a3515affa08845efcf29bd879cc13284914334fdaa23df |
| [.reports/final-entrega-3/github-issue-14.json](../.reports/final-entrega-3/github-issue-14.json) | 4753 | eabf2883b9d812281865916b7b334161ce988e787ba5dff0a99897dd728438d7 |
| [.reports/final-entrega-3/github-issue-15.json](../.reports/final-entrega-3/github-issue-15.json) | 4755 | 795ae0a2cf6b7dd8b35fd4562db0ba011930af24ec0745cb9cea65b7541644a2 |
| [.reports/final-entrega-3/github-issue-16.json](../.reports/final-entrega-3/github-issue-16.json) | 4774 | e823d361490938952c4c9e0e1a22bb1423091d1f0247c23505451a5ba7b068f7 |
| [.reports/final-entrega-3/github-issue-17.json](../.reports/final-entrega-3/github-issue-17.json) | 4917 | f305a751e3791b6415923852928c2a529b00fc0f71e97e389f3d359108366e74 |
| [.reports/final-entrega-3/github-issue-18.json](../.reports/final-entrega-3/github-issue-18.json) | 4941 | 5682ab64287c60750ab69340cc581bf818fe5adf42e769feb4ab8d96c3c99407 |
| [.reports/final-entrega-3/github-issue-19.json](../.reports/final-entrega-3/github-issue-19.json) | 5193 | 240f747b14820440c450184f67bafdb7465af39e74940930738238183f482041 |
| [.reports/final-entrega-3/github-artifacts/image-security-reports/dast.json](../.reports/final-entrega-3/github-artifacts/image-security-reports/dast.json) | 1402 | a9abb06f0c8b040f84ad26e8a931d65d532381ef2bd94e1fae1fe1fe2f094b95 |
| [.reports/final-entrega-3/github-artifacts/image-security-reports/zap-medico.html](../.reports/final-entrega-3/github-artifacts/image-security-reports/zap-medico.html) | 50401 | 46819c936b4fff5e6791c336427052648b7ef46f92388941990e85bbe4b25811 |
| [.reports/final-entrega-3/github-artifacts/image-security-reports/zap-medico.json](../.reports/final-entrega-3/github-artifacts/image-security-reports/zap-medico.json) | 13124 | 38b3b00be79f0430307e1ddfa87711599da1b880265be690233e3406ace4bb80 |
| [.reports/final-entrega-3/github-artifacts/image-security-reports/zap-auditor.html](../.reports/final-entrega-3/github-artifacts/image-security-reports/zap-auditor.html) | 42579 | de73501544f30c6d0b42d27f134d863c1946a5c5bd015873d9a842e2759e58c0 |
| [.reports/final-entrega-3/github-artifacts/image-security-reports/zap-auditor.json](../.reports/final-entrega-3/github-artifacts/image-security-reports/zap-auditor.json) | 10060 | 398ab4689dd5ae848265800992b2d0a7f366f607dc35dd3549279635185fe22d |
| [.reports/final-entrega-3/github-artifacts/image-security-reports/image.json](../.reports/final-entrega-3/github-artifacts/image-security-reports/image.json) | 1494 | 311c2f3a7540801781f4b157bef7e7350f83efeeeee38e95249e615af81b0180 |
| [.reports/final-entrega-3/github-artifacts/image-security-reports/sbom.cdx.json](../.reports/final-entrega-3/github-artifacts/image-security-reports/sbom.cdx.json) | 674708 | 380f507cac2a31507c115670c9d9ba47273572f1c951aaa6084de3b1e646bd43 |
| [.reports/final-entrega-3/github-artifacts/image-security-reports/trivy-image-gate.json](../.reports/final-entrega-3/github-artifacts/image-security-reports/trivy-image-gate.json) | 11490 | 99edc7aaa6aebeaf66426567428e95cc25e101faaef9e39be4f5c710868e2e1c |
| [.reports/final-entrega-3/github-artifacts/image-security-reports/runtime-verification.json](../.reports/final-entrega-3/github-artifacts/image-security-reports/runtime-verification.json) | 825 | 82603988d49854c2925a749437b12bc14df9e7caf067e72d4c9baab98ac325ba |
| [.reports/final-entrega-3/github-artifacts/image-security-reports/linux/api-tests.json](../.reports/final-entrega-3/github-artifacts/image-security-reports/linux/api-tests.json) | 201905 | 22f26951bfec7daeee10209ff07facc5e6e5c79cce9545e3a99647626fab08ea |
| [.reports/final-entrega-3/github-artifacts/image-security-reports/linux/coverage/lcov-report/index.html](../.reports/final-entrega-3/github-artifacts/image-security-reports/linux/coverage/lcov-report/index.html) | 9844 | 680d17da30f91c6563c66cb160ab468974ed475fabb75efc127a865faeeaede4 |
| [.reports/final-entrega-3/github-artifacts/quality-reports/.reports/devsecops/positive-controls.json](../.reports/final-entrega-3/github-artifacts/quality-reports/.reports/devsecops/positive-controls.json) | 302 | fb7e6683c1476a55f3f5a8299ae38e06f3a07e481fd163ef131e261609e383fd |
| [.reports/final-entrega-3/github-artifacts/quality-reports/.reports/devsecops/api-tests.json](../.reports/final-entrega-3/github-artifacts/quality-reports/.reports/devsecops/api-tests.json) | 208260 | eef56ae23e3f319138951919ddafa3e04b3b85a5cde9bb4b061cf1e17095b3af |
| [.reports/final-entrega-3/github-artifacts/quality-reports/.reports/devsecops/frontend-tests.json](../.reports/final-entrega-3/github-artifacts/quality-reports/.reports/devsecops/frontend-tests.json) | 236675 | 3b43c40c9789f97f2daf240f544198fe07464b86da2ffe4a7d52cc65eb3dcc72 |
| [.reports/final-entrega-3/github-artifacts/quality-reports/.reports/devsecops/e2e-tests.json](../.reports/final-entrega-3/github-artifacts/quality-reports/.reports/devsecops/e2e-tests.json) | 1214590 | 577eb57230dc38dbc88ffc70642cd5512fdbf19e4235d6adff27e87852a8ce88 |
| [.reports/final-entrega-3/github-artifacts/quality-reports/.reports/devsecops/tests.json](../.reports/final-entrega-3/github-artifacts/quality-reports/.reports/devsecops/tests.json) | 870 | 932dcb5b1b49081072e84bca5b956e74604845516c90cf83c78bd6446c867e60 |
| [.reports/final-entrega-3/github-artifacts/quality-reports/apps/mobile/coverage/app/coverage-summary.json](../.reports/final-entrega-3/github-artifacts/quality-reports/apps/mobile/coverage/app/coverage-summary.json) | 8187 | b807fc7b356038b3db2d6dcfffc182c000360ebc3e53e95f231ea35de814a767 |
| [docs/evidence/tema-azul/360/01-login.png](../docs/evidence/tema-azul/360/01-login.png) | 29760 | 42ca54c00f64f763f244ebd97bcce00dfd884706879673cc2c01e9463c71469c |
| [docs/evidence/tema-azul/360/04-registro-confirmado.png](../docs/evidence/tema-azul/360/04-registro-confirmado.png) | 36324 | f9379334d3dc66baa6dd5854484207052643ebf8112fe0d00c2372a2f0b59531 |
| [docs/evidence/tema-azul/360/08-panel-medico.png](../docs/evidence/tema-azul/360/08-panel-medico.png) | 44444 | 2b3d60b389f80a7b1169681a6ef7785620ebe82152bd360f42c39c7f93918fdf |
| [docs/evidence/tema-azul/360/10-auditoria.png](../docs/evidence/tema-azul/360/10-auditoria.png) | 44352 | 07b270baf3dd8800d9b50a78f6e9fa2e61d06706a85ba6aeacdae0cc053c4d88 |
| [.reports/final-entrega-3/quality-approved-excerpt.log](../.reports/final-entrega-3/quality-approved-excerpt.log) | 1482 | 93e3c620b58135c59604aee4d0fa1560f2c738f33b8876217ce67d9aa43e8f05 |
| [.reports/final-entrega-3/image-dast-approved-excerpt.log](../.reports/final-entrega-3/image-dast-approved-excerpt.log) | 10566 | f948a45700206af010d525cc0a4bf98356ded7598b4e08099049339972650246 |
| [docs/evidence/entrega-3/github-projects-kanban.png.png](../docs/evidence/entrega-3/github-projects-kanban.png.png) | 99119 | 6b8cace375567c41f8af68e2d7c27bbf606d34c99b4732f8f9f4e49ddea86d4b |
| [docs/evidence/entrega-3/github-projects-planificacion.png.png](../docs/evidence/entrega-3/github-projects-planificacion.png.png) | 115664 | b40325306a9d8000a0f87f04c9321a6f742ca0564900a4a92b1cf4401ae2cccd |
| [.reports/final-entrega-3/projects-review.json](../.reports/final-entrega-3/projects-review.json) | 3769 | 657b96628ba8a9cf1af53a453cec471618445a1ec74db4296beef08e764975ea |

Las cuatro capturas funcionales de tema-azul/360/ fueron inspeccionadas visualmente: login sin credenciales, registro identificado como sintético, panel y auditoría con UUID de los fixtures documentados. Las dos capturas nuevas de entrega-3/ acreditan únicamente ALM. Ninguna debe presentarse como evidencia Android.

Los manifiestos de A2–A4 contienen también hashes de fixtures, reportes JSON, comandos y extractos históricos. archive-review.json conserva esos hashes sin obligar a duplicar aquí las 314 filas. El manifiesto final de los documentos y anexos seleccionados es **.reports/final-entrega-3/manifest-final.json**; se recalcula tras esta actualización e incluye las dos capturas ALM y projects-review.json. Excluye su propio hash. El catálogo y manifiesto anteriores y la comprobación de integridad previa se conservan en .reports/final-entrega-3/history/before-projects-update-*.json. Los ZIP A1–A6 permanecen idénticos; las capturas ALM se adjuntan por separado.

### APK Android y cierre del paquete externo

Destino: **C:\Users\Usuario\Downloads\SIT-CAMA-Entrega-3**. Las rutas de esta tabla son relativas a ese paquete; los hashes se comprueban de nuevo después de copiar.

| Archivo entregado | Bytes | SHA-256 | Alcance |
|---|---:|---|---|
| android/app-debug.apk | 8621347 | 4188438fb2accd3570160f314c44945d6fb1f71c2f4b3dc489ff64d161e8422e | Histórico del origen SIT-CAMA-incremento-01; fecha local 14/11/2026 18:17:42. No atribuido al HEAD actual ni al login nuevo. |
| android/app-debug-284afeb.apk | 5124394 | 64d9bae2fa739c7ee47ff693210b5952b6ede980f0b53d5f9b7fd96c1bc64ef8 | Compilación android-debug autorizada desde las 159 fuentes versionadas de apps/mobile de 284afeb, en copia aislada. |
| android/inicio-medico.png | 223724 | 9700140514ae5489bb5dc5cbe2d51bc007e0dc26c8a33186dde148d16ea895e6 | Captura inspeccionada tras confirmación manual del login sintético MEDICO; muestra Medicina e inicio, sin datos individuales ni credenciales. |

Ambos APK verifican firma **Android Debug v2** con apksigner, salida 0. Certificado público SHA-256: **e749a42d6fa3f1d7ab42474f3cdc6b5844413bf719b5a08a39b6843fdd94fd49**. Esta firma no es Cosign ni firma del backend.

Se comprobó que el APK nuevo instalado tiene el mismo hash que el archivo entregado. El perfil restringe la API al emulador en http://10.0.2.2:3000/api. El estudiante escribió su contraseña directamente en el emulador; no se recibió ni se registra. La primera captura solo mostraba login; la evidencia de sesión es la captura posterior inicio-medico.png. Alcance: instalación, arranque e inicio de sesión manual; quedan pendientes release y aceptación funcional institucional.

El paquete contiene README de entrega, resumen de rúbrica, dos documentos finales, dos capturas Projects, seis ZIP originales, dos APK, captura Android y evidencias seleccionadas. **No contiene una copia completa de .reports.** README incluye el mapa entre las rutas originales del repositorio y las rutas de entrega. Las otras rutas históricas y de código citadas en estos documentos remiten al repositorio de origen.

El manifiesto de los archivos efectivamente entregados es **MANIFIESTO-SHA256.json**; SHA256SUMS.txt ofrece los mismos hashes para lectura directa. Ambos excluyen sus propios bytes para evitar autorreferencia. No deben confundirse con los manifiestos históricos del repositorio.

## 6. Anexos que el estudiante debe adjuntar manualmente

**Disponibles y revisados:**

- [ ] Adjuntar el paquete externo SIT-CAMA-Entrega-3, con los archivos enumerados en su README y MANIFIESTO-SHA256.json. Informe e inventario están en docs/. Una conversión requiere comprobar presentación y calcular un hash nuevo.
- [ ] Adjuntar los dos APK identificados y la captura Android nueva, junto con sus logs de verificación; no sustituir el APK histórico por el nuevo ni atribuirle su login.
- [ ] A1–A4: cuatro ZIP de experimentos indicados en la sección 2, conservando nombres, hashes y manifiestos.
- [ ] A5–A6: los dos ZIP originales del run aprobado; contienen los HTML/JSON DAST, cobertura, SBOM y controles positivos.
- [ ] .reports/final-entrega-3/archive-review.json, evidence-catalog.json, verified-results.json y manifest-final.json.
- [ ] Consultas github-run-approved.json, github-jobs.json, github-artifacts.json, github-pr11.json, github-reviews.json y los ocho github-issue-*.json.
- [ ] Las cuatro capturas web inspeccionadas de docs/evidence/tema-azul/360/, con su contexto sintético. Usar los hashes de la sección 5.
- [ ] Las dos capturas originales de docs/evidence/entrega-3/ y .reports/final-entrega-3/projects-review.json, con los hashes de la sección 5; están fuera de A1–A6.
- [ ] Referencia al PDF oficial con su hash; si la plataforma exige adjuntarlo, aportar el original como fuente docente separada. No publicar sus ejemplos de credenciales como hallazgos del MVP.
- [ ] Completar portada institucional, integrantes y datos académicos reales que no se encuentran acreditados en el repositorio.

**No disponibles o incompletos; no adjuntar sustitutos como si cumplieran el requisito:**

| Pendiente | Qué debe aportar o realizarse después |
|---|---|
| URL directa de GitHub Projects | Tablero y planificación acreditados por las capturas disponibles; queda verificar la URL exacta y adjuntarla. La configuración ya no se considera pendiente. |
| Aceptación y revisión | Revisión formal por pares y aceptación del Product Owner, con alcance y criterios pendientes. PR #11 permanece abierto; no se solicita ni simula aprobación. |
| Android release y procedencia histórica | APK debug histórico y nuevo disponibles y verificados; el commit exacto del histórico sigue sin acreditarse. Release necesita endpoint HTTPS autorizado, firma y validación propias. |
| Validación Android ampliada | Login válido MEDICO del APK nuevo confirmado manualmente y capturado. No se infiere prueba completa de las ocho HU, latencia, todos los roles o aceptación institucional. |
| Bloqueos remotos E1–E3 | PR/run/check fallido por Gitleaks, Semgrep o Trivy y prueba de merge impedido por checks requeridos. Los controles positivos del run verde no sustituyen esos PRs. |
| Orden SAST→empaquetado | Aclarar con el docente la ejecución paralela actual o planificar una corrección autorizada posterior. Este informe no altera workflows. |
| Firma backend MVP | Revisión zlib y autorización formal; digest OCI publicado, firma/atestación y verificación de identidad e issuer de mvp-ci.yml@main. No utilizar Distroless o Express como sustitutos. |
| Alcance extendido de la guía | Evidencia de admisión Kyverno/Kubernetes, procedencia y requisitos SLSA 3, etiquetado HU de artefactos; actualmente no acreditados. |
| HU parciales | Protocolo III–V, decisión profesional, tiempos institucionales, reclasificación, permisos acordados, latencia y aceptación institucional. No marcar completados. |

Para cerrar los experimentos remotos se requiere una autorización posterior y un entorno acordado con el docente: repositorio privado o réplica académica aislada con controles equivalentes y comprobación de checks requeridos. Eso demostraría el bloqueo **en esa réplica**, no en el PR #11 del repositorio público. Los fixtures seguirán fuera del MVP funcional. No se ejecutó ninguna de estas operaciones.

## 7. Conservación y verificación manual

Conservar **sin adjuntar públicamente** .reports/experiment-1/preserved/, el marcador sintético y respaldos de índice. No borrarlos ni agregarlos a un ZIP general. Tampoco adjuntar bases Trivy, ejecutable Cosign de 191 MB, caches, contenedores exportados o directorios completos de .reports.

Comandos de lectura propuestos, desde PowerShell:

```powershell
Set-Location 'C:\Users\Usuario\Downloads\SIT-CAMA-github'
git branch --show-current
git rev-parse HEAD
git status --short
git diff --check
Get-FileHash -Algorithm SHA256 .reports\experiment-2\experimento-2-evidencias.zip
Get-FileHash -Algorithm SHA256 .reports\experiment-3\experimento-3-evidencias.zip
Get-FileHash -Algorithm SHA256 .reports\experiment-4\experimento-4-evidencias.zip
Get-FileHash -Algorithm SHA256 .reports\final-entrega-3\annexes\experimento-1-evidencias-revisadas.zip
Get-FileHash -Algorithm SHA256 .reports\final-entrega-3\github-artifacts\quality-reports.zip
Get-FileHash -Algorithm SHA256 .reports\final-entrega-3\github-artifacts\image-security-reports.zip
Get-Content .reports\final-entrega-3\manifest-final.json
```

El cierre no ejecuta commit, push, merge, publicación ni firma de imágenes. La compilación y firma Android Debug son las autorizadas para el APK nuevo. Se conserva baseline.json como referencia de los 317 archivos originales y delivery-baseline.json como referencia del HEAD 284afeb (321 archivos versionados, árbol inicialmente limpio). Solo se modifican estos dos documentos; código, dependencias, workflows, capturas Projects y política blocked permanecen intactos. Se comprueban rama, HEAD e índice Git, y se mantienen los seis ZIP originales. No se ejecutaron operaciones sobre Docker ni PostgreSQL; el login fue realizado manualmente por el estudiante. La verificación del paquete queda en VERIFICACION-INTEGRIDAD.json y su manifiesto; las comprobaciones históricas del repositorio se conservan.
