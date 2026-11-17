# Bitácora de uso de LLM para el proyecto

El profesor solicitó uso de un LLM para generar código; registrar evidencia de asistencia de IA y validación humana.

| Fecha | Historia | Entrada/requisitos entregados al LLM | Código generado | Prueba ejecutada | Resultado | Revisión humana |
|---|---|---|---|---|---|---|
| 13/11/2026 | HU-07/HU-01/HU-04 (inicio) | Entrega 3, SAD y Artefactos 1–4 | NestJS base, JWT, reglas de triage demo y 38 camas | Compilación aislada del motor triaje | I/II/pendiente pasó en prueba aislada; resto sin instalación de dependencias | Pendiente |
| 14/11/2026 | Frontend HU-01/HU-03/HU-04/HU-07 | Inspeccionar API/DTO reales; Ionic standalone, sesión en memoria, RBAC, datos sintéticos, CORS desarrollo y preparación Android HTTPS | Login, menú por rol, registro/triaje inicial, búsqueda exacta limitada, censo con filtros, API centralizada, guardas, diseño adaptable y documentación | Frontend: 19 unitarias, 20 E2E reales móvil/escritorio, lint y build. API: 99 pruebas con cobertura y build. Docker health/CORS e inspección de capturas | Aprobado localmente; esquemas temporales eliminados y tablas públicas sin cambios. Sin publicación en GitHub. HU-02/05/06/08 y APK/validación Android pendientes. Ver frontend.md | Pendiente |

### Verificación de Android debug

Actualización 14/11/2026 — Android debug: se rastreó el aviso hasta
`ApiConfigurationError` por `nativeApiUrl` vacía, antes de cualquier petición.
Se añadió perfil de emulador, comprobación del flag nativo debug, transporte
HTTP selectivo y Network Security Configuration por variante/host; release
conserva HTTPS. Se aprobaron 23 unitarias frontend, 20 E2E navegador, cuatro
pruebas CORS y dos instrumentadas Android. Se compilaron/sincronizaron producción
y debug, se inspeccionó el XML del release sin firmar y se probó un 401 real
contra Docker desde el APK con credenciales ficticias inexistentes. Sin cambios
de contraseñas, claves, volúmenes o pacientes existentes ni publicación GitHub.
Revisión humana pendiente. Detalles y archivos: [Android debug](android-debug.md).

### HU-05 / HU-06 — 14/11/2026

Se inspeccionó PostgreSQL real y se confirmó con el usuario la política MEDICO
para asignar/liberar, SERVICIOS para limpiar, último triaje demo I/II y servicio
coincidente, sin inventar reglas de edad/aislamiento. Se implementaron DTO,
bloqueos, versiones de ciclo, auditoría transaccional y confirmaciones en Ionic.
Resultado local: 127 pruebas API; cobertura 99,74 % sentencias, 91,80 % ramas,
100 % funciones/líneas; build API aprobado. Frontend: 32 unitarias, 26 E2E reales
móvil/escritorio, lint e ionic build aprobados. Los esquemas temporales se eliminan
y sus snapshots confirman tablas públicas intactas. Compilación APK debug con
interfaz actualizada; aceptación integral en Android y difusión subsegundo entre
clientes no afirmadas. Revisión humana/DoD global pendientes. Sin GitHub.
Detalle: [informe HU-05/HU-06](HU-05-HU-06.md). Se detiene antes de HU-02/HU-08.

### HU-02 / consulta HU-08 — 14/11/2026

Se inspeccionaron backlog, decisiones, columnas/trigger PostgreSQL reales,
JWT/RBAC, servicios, configuración HTTP/Android y pruebas. Se implementaron panel
MEDICO I/II/pendiente, avisos Socket.IO posteriores al COMMIT con autenticación
de conexión/eventos/entregas y consulta AUDITOR con filtros, cursor y campos
limitados. Nuevas lecturas auditadas transaccionalmente. Se mantuvieron esquema,
datos, secretos, transacciones anteriores y protecciones release.

Resultado: 167 pruebas API aprobadas; cobertura 99,49 % sentencias, 92,44 % ramas,
99,03 % funciones, 100 % líneas; build API aprobado. Frontend: 40 unitarias,
32 E2E móvil/escritorio, lint e ionic build aprobados. Capacitor sync y APK debug/
release compilados; 2 pruebas instrumentales app aprobadas. Verificación UI real
en emulador: aviso nativo I, reconexión tras corte TCP con recuperación HTTP,
segundo plano, consulta de auditoría y restricciones SERVICIOS. Esquemas privados
eliminados y snapshots públicos intactos; API Docker restaurada healthy.

No se afirman reclasificación III→II por especialista, validación clínica,
audibilidad humana, inmutabilidad ante administradores, entrega durable ni DoD
global. Revisión humana y aceptación PO pendientes. Sin publicación en GitHub.
Detalle reproducible y archivos: [informe HU-02/HU-08](HU-02-HU-08.md).
Se detiene el incremento en HU-02/HU-08.

### Prompt sugerido para el siguiente incremento

> Actúa como ingeniero de software senior. Continúa el monorepositorio SIT-CAMA entregado; no reemplaces la arquitectura ni destruyas los archivos previos. Usa NestJS 11, Ionic Angular, PostgreSQL, Docker y GitHub Actions. Debes cumplir la HU-XX y los dos escenarios Gherkin adjuntos. Los endpoints siempre aplican JWT/RBAC en el servidor, no exponen PII en logs y escriben auditoría en transacciones. Genera solo los archivos que cambian, pruebas positivas/negativas, comandos para compilar/probar y riesgos. No inventes reglas clínicas ausentes ni simules evidencia de CI. Si una HU queda incompleta, márcala pendiente.

### Incremento 08 — ampliación de pruebas y detención por defecto

14/11/2026 (Bogotá). Solicitud: inspeccionar Jest/Vitest/Playwright, DTO y criterios;
añadir solo casos útiles de entradas, texto hostil, triaje, JWT/RBAC, concurrencia,
auditoría y regresión; detenerse ante un defecto que requiera cambiar producción.

Se conservaron las pruebas previas y se añadieron 38 casos API, 29 unitarios de
formulario y cuatro escenarios E2E en dos perfiles (8 ejecuciones). Línea base
real: 168 API, 76 frontend y 35 E2E aprobados. Fase ampliada completa: 203 API,
105 frontend y 43 E2E aprobados. Sonda posterior de auditoría: 2 aprobados y 1
fallido; no se afirma una suite API final verde ni una nueva ejecución completa
tras el fallo. Cobertura API del último run completo: 99.49/92.44/99.03/100 %;
frontend: 84.49/86.81/81.63/87.45 % (statements/branches/functions/lines).

Defecto INC08-AUDIT-01: un rango from/to invertido en un microsegundo recibe 200
en lugar de 400 y registra READ_AUDIT. Date.parse() iguala ambos valores en
milisegundos. Se detuvo la implementación, se dejó habilitada la regresión y se
documentó una propuesta de comparación con precisión timestamptz, sin aplicarla.
No hay exposición clínica confirmada. Solo bases temporales, datos sintéticos y
cargas acotadas; 178 archivos de producción/configuración/.env mantienen sus
hashes. Sin cambios de imagen Docker, secretos, datos existentes o GitHub.

Revisión humana y autorización de corrección: pendientes. Informe y matriz:
[INCREMENTO-08-PRUEBAS.md](INCREMENTO-08-PRUEBAS.md). Resultados originales y
SHA-256: [evidence/tests/manifest.json](evidence/tests/manifest.json).
