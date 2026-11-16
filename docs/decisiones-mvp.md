# Decisiones iniciales (sujetas a validación del equipo)

**Origen:** Artefactos 1–5 y la guía de Entrega 3. El código generado por LLM debe ser revisado, probado y auditado por el equipo.

- **Arquitectura:** Ionic Angular + Capacitor; NestJS monolito modular, PostgreSQL y Docker, conforme al SAD.
- **Roles de demostración:** ENFERMERO, MEDICO, ADMISIONES, COORDINADOR, SERVICIOS y AUDITOR. Las autorizaciones se verifican en servidor, no solo en interfaz.
- **Inventario:** 38 camas ficticias distribuidas 15/8/12/3, códigos UA/UP/OBS/AIS. Las denominaciones definitivas se deben acordar.
- **Estados:** AVAILABLE, OCCUPIED, CLEANING, BLOCKED. La guía más reciente requiere visualización de Bloqueada; definir procedimiento autorizado para bloqueo/desbloqueo, no inventarlo.
- **Transiciones:** DISPONIBLE → OCUPADA → LIMPIEZA → DISPONIBLE. Para HU-05/HU-06 el usuario confirmó MEDICO exclusivamente para asignar/liberar, y SERVICIOS para confirmar limpieza. Liberar termina una asignación de cama; no implementa un episodio/alta clínica.
- **Triaje:** El motor inicial solo demuestra ejemplos I/II. Si no se activan estos criterios, exige revisión manual. No se impone un tiempo a niveles III–V. La clasificación no sustituye juicio clínico.
- **Datos sensibles:** Nombre/documento/signos se guardan cifrados con AES-256-GCM en las columnas existentes; la búsqueda exacta usa HMAC con clave independiente. Ver `HU-01-HU-03.md` para configuración y límites. IndexedDB cifrado sigue pendiente.
- **Auditoría:** Insert-only con transacciones y trigger de integridad. Aún pendiente roles DB separados y almacenamiento resistente a administradores para afirmar inmutabilidad fuerte.
- **Concurrencia:** Índices únicos parciales más bloqueos PostgreSQL implementados/probados para HU-05/HU-06, incluidas dos instancias simultáneas. Ver `HU-05-HU-06.md`.
- **Datos:** Solo valores sintéticos y cuentas demo, sin diagnósticos ni pacientes verdaderos.
- **APK:** Android debug con Capacitor para evaluación; confirmar necesidad de firma de distribución si el profesor la exige.

## Decisiones que NO deben quedar implícitas en prompts

1. Permisos para asignación por ENFERMERO frente a MEDICO: resuelto para este incremento, solo MEDICO por confirmación del usuario; no se extiende el permiso a ENFERMERO.
2. Reglas y tiempos para triaje III–V; no deducibles de los ejemplos dados.
3. Quién puede bloquear/desbloquear cama y por qué.
4. Manejo de pacientes sin identificación y re-clasificación por especialista.
5. Alcance del informe del auditor, formato CSV/PDF y retención.
6. Cómo se demuestra el cifrado de borradores offline en PWA y en APK.

**Se documentarán expresamente las simplificaciones académicas.**
