# Incremento 10 — Inicialización PostgreSQL en DAST

Validación local del 16 de noviembre de 2026, en la rama feature/sit-cama-mvp-entrega-3, sobre f78fdead78186bb5f1661c4218ba0a48a9cb9cdf. El árbol estaba limpio al inicio. Se modificó únicamente .ci/dast.cjs y se añadió este informe. No se ejecutó commit, push ni merge; no se modificó main ni se publicó o firmó una imagen.

**Causa comprobada.** El [run 43916628544](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43916628544) tiene [quality aprobado](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43916628544/job/133472397820). El [job image-dast](https://github.com/yuliethqui/sit-cama-devsecops/actions/runs/43916628544/job/133472397626) aprobó verificación de base, construcción/escaneo y 18 suites con 244 pruebas API; falló al ejecutar el SQL inicial de DAST, antes de iniciar ZAP. Se obtuvo el registro completo mediante el conector GitHub y se confirmó el error del socket Unix. Esos resultados API pertenecen a esa ejecución remota: no representan una nueva ejecución local de las 244 pruebas.

El entrypoint de la imagen PostgreSQL fijada en .ci/tools.lock.json inicia un servidor temporal con listen_addresses='', prepara la base y detiene ese servidor antes de arrancar el definitivo. El pg_isready sin -h usa el socket Unix y puede devolver éxito durante esa fase temporal. Entre su parada y el arranque definitivo desaparece /var/run/postgresql/.s.PGSQL.5432; el psql siguiente también usaba ese socket y podía fallar. Aumentar una pausa fija no elimina esa carrera.

**Reproducción real.** Se utilizó la misma imagen PostgreSQL, almacenamiento tmpfs y una red interna nueva. Un fixture shell retuvo la fase temporal de inicialización mediante FIFO; se liberó al completar las comprobaciones, sin una espera fija para simular el arranque. Se observó:

    /var/run/postgresql:5432 - accepting connections
    socket_probe_exit=0
    127.0.0.1:5432 - no response
    tcp_during_temp_exit=2
    socket_disappeared=true
    psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: No such file or directory
    127.0.0.1:5432 - accepting connections
    1

La consulta final SELECT 1 se ejecutó por TCP. El fixture no modificó el SQL ni el esquema del proyecto. Un primer intento del fixture local tenía finales CRLF incompatibles con su shebang; se corrigió a LF antes de esta reproducción válida. El contenedor y la red de reproducción fueron eliminados y se comprobó su ausencia.

**Corrección.**

- Readiness mediante pg_isready -h 127.0.0.1 -p 5432 -t 1, con plazo de 60 segundos y sondeos condicionados separados por un máximo de un segundo. Cada invocación Docker de sondeo/estado tiene un timeout de cinco segundos. Si el contenedor termina, se falla anticipadamente. Se conserva el último error y no se usa una pausa inicial fija.
- SQL inicial mediante psql -h 127.0.0.1 -p 5432 -w -v ON_ERROR_STOP=1, con los mismos usuario y base. Docker exec -e PGPASSWORD transmite la contraseña efímera por entorno, sin incluir su valor en argumentos. PGCONNECT_TIMEOUT=3 acota la conexión; el proceso SQL tiene un máximo de 60 segundos.
- Si readiness o SQL inicial fallan, se retienen el estado seleccionado del contenedor y sus últimas 60 líneas de logs, capturando stdout y stderr. No se vuelca Config.Env ni un inspect completo. Cada recogida tiene timeout de cinco segundos y salida acotada; se redactan claves generadas y JWT antes de truncar. Si la recogida no termina correctamente, se informa del error y se omite su salida parcial. El fallo original sigue dando status: failed y salida no exitosa.

El plazo de readiness limita los reintentos; una llamada Docker que ya está en curso y la recogida de diagnósticos tienen sus límites adicionales. No se afirma un límite exacto de 60 segundos para todo el proceso DAST.

**Nueva ejecución completa de DAST.** Se construyó localmente sitcama-api:inc10-dast desde el árbol actual, con las bases fijadas y runtime UID 10001:10001. ID: sha256:7c9da2860dc70e198e8e77621ffbc511e4ba97495db877161a29a399ec54f632. PostgreSQL utilizó postgres:17-alpine@sha256:d3244e8ce3f165ee3c93d9c4a4b1d0fe48b3a89e2287b717fdcbbde92d405065; ZAP utilizó el digest existente de la versión 2.17.0. No se cambiaron versiones ni dependencias.

La ejecución fue desde 2026-11-16T17:30:26.932Z hasta 2026-11-16T17:31:04.634Z, con salida 0. El readiness TCP quedó aprobado tras dos sondeos y 1245 ms. Se aplicó el SQL inicial sin cambios y se crearon únicamente los tres usuarios sintéticos de DAST, mediante el seed existente con sus guardas de aislamiento.

| Comprobación | Resultado nuevo local |
| --- | --- |
| MEDICO | HTML y JSON generados; 10 lecturas autenticadas; 0 bloqueantes |
| AUDITOR | HTML y JSON generados; 10 lecturas autenticadas; 0 bloqueantes |
| Acceso MEDICO a /triage/panel | 200 esperado y obtenido |
| Acceso AUDITOR a /audit/events | 200 esperado y obtenido |
| SERVICIOS a panel y auditoría | 403 esperado y obtenido en ambos |
| Acceso anónimo a /beds | 401 esperado y obtenido |
| ZAP | Ambos procesos finalizaron correctamente; una alerta informativa por rol |

El contrato escaneado conserva los endpoints existentes: MEDICO alcanza health, beds, panel, búsqueda y preview; AUDITOR alcanza auditoría. Los contadores READ_TRIAGE_PANEL y READ_AUDIT aumentaron durante los escaneos, acreditando la llegada a handlers autenticados. Los reportes tienen un sitio analizado y ningún hallazgo de riesgo MEDIUM/HIGH. Continúan bloqueando los riesgos riskcode >= 2, los errores del scanner, reportes ausentes y falta de lecturas autenticadas.

Los cuatro reportes están en .reports/inc10/dast-complete/, ignorados y sin copiarse como evidencia pública al repositorio. Se verificó estructura JSON, presencia de HTML y ausencia de JWT completos en su contenido. Sus hashes permiten comprobar los archivos locales:

| Archivo | Bytes | SHA-256 |
| --- | ---: | --- |
| zap-medico.json | 13124 | 67f2ee08a157345a6972f04a4058a9a044c194adbb8766a2a8d371100d8d904c |
| zap-medico.html | 50401 | c061cd75bd9c5140b6baf784afa1c156fca5bc96483bc5935d64d1edae884752 |
| zap-auditor.json | 10062 | 1a99722df00bb4ef2c64cf5b68d9fa0d47db5a7c13cb55ce1cefc580f177e85f |
| zap-auditor.html | 42582 | 9aecc4a779f18359335cb7befac4de719a016a0d10256d85cb4fe42da4d35401 |

dast.json: SHA-256 7ff19b9bcdd53c9ea460d243884f9e88a655dd4bcd14d83d03f0587c6f0f1e86. Archivo .ci/dast.cjs validado: SHA-256 82f949cf80c05addc1a57ff7a51b3215ae859cc95678247f3d662ad38bf11f58.

**Pruebas negativas y comprobaciones adicionales.**

| Caso controlado, solo en fixtures locales ignorados | Resultado |
| --- | --- |
| Init del contenedor falla con código 42 | Node termina con 1; detección anticipada; estado y stderr retenidos; contraseña sintética reemplazada por [REDACTED] |
| Init permanece retenido, contenedor aún activo | 54 sondeos; timeout a los 60007 ms; Node termina con 1; último error y diagnósticos retenidos |
| SQL inicial apunta a una base sintética inexistente | TCP listo, error SQL propagado con salida 1 y diagnósticos; ZAP no se inicia |
| Sintaxis Node | Correcta en Windows y Linux/Node 22.23.5 |
| Pruebas de infraestructura CI existentes | 10/10 Windows y 10/10 Linux; sin modificaciones |
| Gitleaks del árbol candidato | 0 hallazgos con configuración y digest existentes |
| Espacios e integridad | git diff --check correcto; índice y bloqueo de publicación conservados |

Las tres pruebas negativas comprobaron que los diagnósticos no contienen las claves sintéticas generadas, que no arrancó ZAP y que se eliminaron sus propios contenedores y redes. El timeout completo, incluidos diagnósticos y limpieza, duró aproximadamente 61.047 segundos. Los fixtures y sus resultados están únicamente en .reports/inc10/; no forman parte de los cambios candidatos.

**Limpieza y alcance.** Se verificó la ausencia de los contenedores -db, -api, -medico y -auditor del UUID del DAST completo, de su red interna y de su workspace temporal. También se verificó la limpieza de la reproducción y de los tres casos negativos. Todos los IDs de contenedores y redes existentes antes de las pruebas siguen presentes. El código de limpieza conserva los nombres específicos creados por cada ejecución y no usa búsquedas globales, prune ni eliminación de volúmenes. No se conectó ninguna base de trabajo ni volumen persistente; PostgreSQL usó exclusivamente tmpfs.

Los otros 315 archivos previamente versionados conservan sus bytes. La sección de ejecución API/ZAP, RBAC, criterios de bloqueo y limpieza es idéntica a la versión inicial. No cambiaron código clínico, frontend, pruebas API, SQL, esquema, workflows, Gitleaks, Semgrep, Trivy, cobertura, lockfiles ni requisitos de Cosign. .ci/publication-review.json conserva status: blocked y SHA-256 40a0e9871c2e040a63f35738785e0e6717b653f842d19c2ea15f18f1ce826265.

**Comprobación local y límites.** La orquestación local se ejecutó en Windows con Node 22.15.0; PostgreSQL, API y ZAP se ejecutaron en Docker Linux. La sintaxis y las pruebas de infraestructura se comprobaron además con Node 22.23.5 en Linux. Las 244 pruebas API, Trivy/SBOM, el job quality y la verificación Cosign aprobados citados arriba son del run remoto anterior y no se atribuyen a una repetición local de este incremento. Queda pendiente un nuevo run completo de Actions con la corrección, después de la revisión y autorización para commit/push.

Para repetir DAST en este clon, sin publicar imágenes y conservando reportes en un directorio nuevo:

    Set-Location 'C:\Users\Usuario\Downloads\SIT-CAMA-github'
    git branch --show-current
    git diff --check
    docker build -t sitcama-api:inc10-dast -f apps/api/Dockerfile apps/api
    $env:SITCAMA_CI_IMAGE = 'sitcama-api:inc10-dast'
    $env:SITCAMA_REPORT_DIR = '.reports/inc10/review-run'
    node .ci/dast.cjs
    Get-Content .reports/inc10/review-run/dast.json
    Get-ChildItem .reports/inc10/review-run/zap-*.html, .reports/inc10/review-run/zap-*.json

No se incluyeron instrucciones de publicación ni se ejecutaron operaciones remotas de escritura.
