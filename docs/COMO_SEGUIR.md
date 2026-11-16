# Qué construir después del Incremento 01

1. **HU-01:** registro transaccional, cifrado AES-256-GCM, HMAC, historial y auditoría implementados y probados (ver `HU-01-HU-03.md`). Pendientes validación clínica, protocolo III–V y flujo de pacientes sin identificación; conservar el carácter demostrativo del motor.
2. **HU-02/03:** búsqueda exacta y panel MEDICO con avisos Socket.IO autorizados implementados y verificados localmente. Pendientes entrega durable/múltiples instancias, aceptación clínica y rendimiento de búsqueda <500 ms bajo carga acordada. Ver `HU-02-HU-08.md`.
3. **HU-06:** transacciones Postgres con bloqueos, asignación y liberación MEDICO, conflictos concurrentes y auditoría implementados. Sigue pendiente difusión subsegundo del censo a otros clientes.
4. **HU-04/05:** matriz Ionic de 38 camas y limpieza SERVICIOS implementadas y probadas. Bloqueo/desbloqueo y actualización en vivo del censo requieren otro incremento autorizado.
5. **HU-08:** consulta AUDITOR de solo lectura, filtros/cursor, redacción y auditoría transaccional implementados. Pendientes reclasificación por especialista con motivo, roles DB separados, exportación/retención y resistencia a administradores.
6. **Continuidad:** borradores cifrados locales e idempotencia al reconectar. Las camas no deben modificarse sin conexión.
7. **Android:** APK debug probado en emulador, incluidos panel en vivo, reconexión y auditoría. Release compila y bloquea HTTP; falta configurar HTTPS real, firma y validación de distribución/dispositivo físico.
8. **CI/CD final:** actualización del workflow `sign-image.yml` para construir y firmar el backend verdadero, Syft CycloneDX, escaneo de contenedor, staging con Postgres y ZAP HTML. Registrar enlaces a experimentos aislados y checks de PR.

## Restricción de seguridad

No crear un clasificador que parezca clínicamente validado usando solo los ejemplos de la entrega. Mantener advertencia de uso académico hasta contar con criterios de referencia del responsable clínico.
