# Plan intensivo — 13 a 16 de noviembre de 2026

**Meta:** 8 HU completas, PWA, APK Android debug y repositorio con DevSecOps y evidencias. Este tiempo es limitado; dividir trabajo entre las tres personas del equipo de ser posible.

| Fecha | Dev/API | Cliente/PWA/APK | GitHub y seguridad | Evidencia de cierre |
|---|---|---|---|---|
| Vie 13 | DB, NestJS, JWT, roles, tests motor; integrar CI | Inicializar Ionic Angular y pantallas de login/navegación | Reglas main y PR del scaffold | `docker compose`, `/api/health`, tests, PR |
| Sáb 14 | Pacientes, triaje persistido, búsqueda, asignación/release transaccional y Socket.IO | Formulario triaje, tablero médico, matriz 38 camas, UI según roles | Gherkin e Issues HU-01..08; añadir escenarios CI | Prueba extremo a extremo HU-01/02/03/04/05/06 |
| Dom 15 | Auditoría completa, reportes y offline cifrado sin datos reales | Integrar alertas y listas; Capacitor Android; producir APK debug | Escaneo SCA, SAST, firma nueva imagen, SBOM, DAST | APK instalado, reporte ZAP, firmas verificadas |
| Lun 16 | Corregir fallos críticos y validar concurrencia | Ajustar UI y repetir demostración | Revisión pares, protección main, evidencias y cuestionario | PR aprobado, checks, demo y entrega |

## Prioridades innegociables

- App real con usuarios distintos (enfermero, médico, servicios generales, auditor).
- Los 8 Issues en GitHub Projects y vínculo commits/PRs. Cada Issue tendrá 2 escenarios Gherkin (normal/crítico), DoR y DoD.
- Pruebas reales: triage I/II, límites, lista 38 camas, transiciones, bloqueo de acceso, doble asignación, auditoría, desconexión.
- 80 % de cobertura del código establecido para las ocho HU (no solo una clase de demostración).
- En final: Gitleaks + Semgrep + Trivy + Syft CycloneDX + escaneo de contenedor + Cosign OIDC + ZAP HTML.
- Evidencias de bloqueo real de PR por fallos de secreto, SQL injection y SCA. Mantener ejemplos vulnerables solo en ramas aisladas y datos ficticios.
- Captura en Android de APK ejecutándose y conexión con backend de demostración.

## Criterio de priorización cuando el tiempo no alcance

Terminar primero un flujo demostrable y seguro: login → registrar caso de prueba → clasificar → alertar médico → asignar cama → liberar para limpieza → dejar disponible → auditoría. Registrar explícitamente como **pendiente** cualquier comportamiento no validado. Nunca simular el cierre de una HU.

## Límite clínico

Las categorías I/II en el código inicial proceden de ejemplos de la guía. Las reglas completas I–V, reevaluación y tiempos III–V requieren decisión y aprobación del referente clínico para uso hospitalario; el MVP académico solo usará casos ficticios. Esta dependencia no se resuelve automáticamente generando código con un LLM.
