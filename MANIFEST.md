# Manifest del incremento 01

**Actualización local 14/11/2026:** HU-02 y consulta HU-08 implementadas y verificadas
con 167 pruebas API, 40 unitarias frontend, 32 E2E y emulador Android. Release
compila con tráfico HTTP bloqueado. Ver [archivos, contratos, evidencia y límites](docs/HU-02-HU-08.md).
El estado original del paquete descrito más abajo es histórico; no representa
las comprobaciones actuales. No se publicó en GitHub.

Este ZIP fue creado como **propuesta de cambios** para el repositorio `yuliethqui/sit-cama-devsecops`, no como commit remoto. Las rutas son relativas a la raíz del repositorio y **no sobrescriben** los archivos existentes observados en `main` al 13/11/2026.

- `apps/api/`: inicio NestJS, autenticación, guardas de roles, consulta de camas, limpieza con auditoría, motor de triaje de demostración y sus pruebas.
- `apps/api/db/001_initial.sql`: tablas, índices y 38 camas sintéticas.
- `compose.yaml`: PostgreSQL + API para el entorno local.
- `.github/workflows/mvp-ci.yml`: Quality Gates iniciales (secreto, test de motor, SAST, SCA, Docker). No es el pipeline final de todos los controles.
- `.pre-commit-config.yaml`: hook Gitleaks local.
- `docs/`: backlog de 8 HU, plan 13–16, registro LLM, decisiones abiertas y guía Android.
- `.env.example`, `.gitignore.mvp`, `README-MVP.md`: instrucciones y configuración sin credenciales.

## Estado de verificación al generar el paquete

- JSON y YAML: parseados sin errores.
- Clasificador TypeScript: compilado aisladamente con `tsc` global; probado con Node para I, II y pendiente de revisión.
- NestJS, PostgreSQL, GitHub Actions, Docker y APK: **no verificados** en ejecución en este entorno (sin dependencias npm, Docker ni Android SDK).
- El proyecto requiere ejecutar `npm install` en `apps/api` para generar el lockfile antes de CI.

No se publica información clínica real ni se entregan vulnerabilidades experimentales como código normal.
