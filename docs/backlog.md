# SIT-CAMA — Product Backlog (para crear Issues en GitHub)

## Gobernanza común

- **Épicas:** EP-01 Triaje digital (HU-01/02/03); EP-02 Camas (HU-04/05/06); EP-03 Seguridad y auditoría (HU-07/08).
- **Sprint 1:** HU-01 5 SP, HU-02 3 SP, HU-03 2 SP, HU-07 3 SP (13 SP).
- **Sprint 2:** HU-04 5 SP, HU-05 3 SP, HU-06 3 SP, HU-08 3 SP (14 SP).
- **Columnas Kanban:** Backlog, Ready for Dev, In Progress, Security Review, Done.
- **DoR:** HU en formato Como/Quiero/Para, INVEST, >= 2 criterios Gherkin normal y crítico, mockup, puntos, prioridad y dependencias definidas.
- **DoD:** código probado, revisión pares, cobertura >=80 % para el sistema final, sin secretos, SAST y SCA aprobados, imagen escaneada/firmada, staging, aceptación del PO. No marcar Done por código generado sin probar.
- **Trazabilidad:** rama `feature/HU-XX-nombre`, commit `feat(HU-XX): ...`, PR `Closes #<NUMERO_ISSUE>`, pruebas en el cuerpo del PR.

## HU-01 — Registrar y clasificar triaje (5 SP, Must, Sprint 1)

**Como** Enfermero triador **quiero** registrar identificación, motivo, signos y clasificación **para** priorizar atención. **Dependencias:** HU-07, reglas clínicas validadas.

```gherkin
Escenario: Saturación crítica de demostración
  Dado un registro de pruebas con SpO2 84 % y Glasgow 15
  Cuando el enfermero solicita la clasificación
  Entonces el motor propone Triaje I con espera 0 minutos y alerta visible

Escenario: Caso que no cumple reglas I/II disponibles
  Dado un registro con SpO2 98 %, Glasgow 15 y EVA 1
  Cuando el enfermero solicita la clasificación
  Entonces el sistema pide validación clínica y no inventa un nivel III–V
```

**Estado:** Persistencia implementada y probada: paciente/triaje inicial transaccionales, historial, cifrado y auditoría. El motor sigue siendo demostración I/II; los casos no determinados requieren revisión clínica. Reglas aprobadas III–V y aceptación clínica pendientes. Ver `HU-01-HU-03.md`.

## HU-02 — Tablero de urgencias y alarma (3 SP, Must, Sprint 1)

**Como** Médico **quiero** ver pacientes ordenados por gravedad y espera **para** reconocer ingresos críticos.

```gherkin
Escenario: Alerta crítica
  Dado que un médico tiene el tablero abierto
  Cuando se confirma un nuevo paciente Triage I
  Entonces aparece primero, muestra aviso visual y suena una alarma de tres segundos

Escenario: Reconexion del tablero
  Dado que el tablero perdió conexión
  Cuando el médico vuelve a conectarse
  Entonces recupera del servidor el orden vigente sin duplicar pacientes
```

**Estado:** Alcance académico local implementado y verificado: panel MEDICO paginado, último triaje por paciente en 24 horas, orden I/II/revisión pendiente y mayor espera primero; Socket.IO autorizado en handshake, eventos y entregas; aviso visual y sonido de tres segundos tras activación explícita. Reconexión y vuelta desde segundo plano comprobadas en navegador/emulador. Entrega durable, validación clínica, revisión humana y DoD global pendientes. Ver [HU-02/HU-08](HU-02-HU-08.md).

## HU-03 — Búsqueda de pacientes (2 SP, Should, Sprint 1)

**Como** Personal de Admisiones **quiero** buscar por documento **para** consultar estado de atención y espera.

```gherkin
Escenario: Búsqueda exacta
  Dado un paciente sintético admitido
  Cuando el usuario autorizado busca su documento exacto
  Entonces ve la categoría vigente y tiempo transcurrido en menos de 500 ms bajo carga acordada

Escenario: Usuario sin permiso
  Dado un usuario de Servicios Generales
  Cuando intenta buscar por cédula
  Entonces la API responde 403 y no devuelve datos personales
```

**Estado:** Búsqueda exacta por HMAC implementada y probada, con categoría/tiempo desde último triaje y RBAC. Pendiente acordar carga y demostrar el objetivo de menos de 500 ms; el esquema aún no representa episodios/espera real. Ver `HU-01-HU-03.md`.

## HU-04 — Matriz de 38 camas (5 SP, Must, Sprint 2)

**Como** Coordinador de camas **quiero** visualizar camas por servicio y estado **para** conocer disponibilidad.

```gherkin
Escenario: Estados visuales de cama
  Dado que hay 38 camas sintéticas cargadas
  Cuando un usuario autorizado abre el censo
  Entonces ve Disponible #2ECC71, Ocupada #2980B9, Limpieza #F1C40F y Bloqueada #7F8C8D

Escenario: Filtro sin resultados
  Dado un filtro que no corresponde a ninguna cama
  Cuando se aplica
  Entonces la interfaz indica "Sin resultados" sin inventar registros
```

**Estado:** Parcial (esquema y GET de censo, falta UI y tiempo real).

## HU-05 — Desinfección terminal (3 SP, Must, Sprint 2)

**Como** Servicios Generales **quiero** pasar una cama de Limpieza a Disponible **para** habilitarla tras aseo.

```gherkin
Escenario: Desinfección completada
  Dado que una cama está en Limpieza y el usuario tiene rol Servicios
  Cuando confirma la desinfección
  Entonces cambia a Disponible y audita usuario, hora y estado previo

Escenario: Transición inválida
  Dado que una cama está Ocupada
  Cuando se intenta finalizar su limpieza
  Entonces el servidor responde conflicto y conserva el estado
```

**Estado:** Flujo local implementado y verificado: MEDICO libera OCCUPIED → CLEANING y SERVICIOS confirma CLEANING → AVAILABLE, con confirmaciones de ciclo, tiempo de limpieza y auditoría transaccional. Pruebas API y E2E aprobadas. Revisión humana/DoD global pendientes. Ver [HU-05/HU-06](HU-05-HU-06.md).

## HU-06 — Asignación atómica de cama (3 SP, Should, Sprint 2)

**Como** Médico **quiero** vincular un paciente I/II de demostración a cama libre del servicio solicitado **para** actualizar el censo. Solo MEDICO está autorizado en este incremento, según confirmación del usuario; I/II es una restricción académica del MVP, no una norma clínica.

```gherkin
Escenario: Vinculación exitosa
  Dado un paciente sintético de Triaje I sin cama y una cama Disponible
  Cuando un profesional autorizado la asigna
  Entonces la cama queda Ocupada y se publica el cambio en menos de un segundo

Escenario: Concurrencia
  Dado que dos médicos intentan asignar simultáneamente la misma cama
  Cuando ambos envían la solicitud
  Entonces solo una transacción confirma y la otra recibe conflicto
```

**Estado:** Núcleo transaccional y UI implementados y verificados: dos instancias y solicitudes concurrentes, un ganador/409, sin doble asignación y con rollback de auditoría. Actualización HTTP tras confirmar; publicación entre otros clientes en menos de un segundo y DoD global aún no verificados. No se declara tiempo real. Ver [HU-05/HU-06](HU-05-HU-06.md).

## HU-07 — JWT, RBAC y habeas data (3 SP, Must, Sprint 1)

**Como** Responsable de seguridad **quiero** autenticar y limitar permisos **para** reducir la exposición de datos clínicos.

```gherkin
Escenario: Vista de Servicios Generales
  Dado que el usuario inició sesión como Servicios Generales
  Cuando solicita el censo de camas
  Entonces recibe solo código, servicio y estado, sin nombres ni signos vitales

Escenario: Token faltante
  Dado que una solicitud no tiene token JWT
  Cuando intenta acceder a triaje o camas
  Entonces la API responde 401 sin revelar datos
```

**Estado:** Parcial (login, JWT, guardas, cifrado de paciente y pruebas negativas de HU-01/HU-03 implementados; refresh y validaciones del sistema completo pendientes).

## HU-08 — Auditoría inalterable y anonimización (3 SP, Must, Sprint 2)

**Como** Auditor **quiero** consultar bitácora protegida **para** revisar cambios de triaje y camas.

```gherkin
Escenario: Reclasificación de paciente
  Dado que un médico autorizado modifica triaje III a II con motivo registrado
  Cuando confirma la operación
  Entonces queda evento con fecha, actor, motivo y valor anterior sin borrar el historial

Escenario: Intento de alteración de bitácora
  Dado un usuario operativo sin permiso de administrar auditoría
  Cuando solicita editar o eliminar un evento
  Entonces el sistema rechaza la acción y conserva el evento intacto
```

**Estado:** Consulta AUDITOR implementada y verificada localmente: filtros, cursor bigint, actor UUID y campos seguros, sin edición/borrado; lecturas auditadas transaccionalmente. Se conserva el trigger existente. El escenario de reclasificación III→II con motivo por especialista continúa pendiente de definición e implementación; este incremento no incorpora reglas III–V. Inmutabilidad frente a administradores DB, exportación/retención y DoD global pendientes. Ver [HU-02/HU-08](HU-02-HU-08.md).

## Evidencias para cada Issue

Guardar vínculo al PR, commit SHA, pruebas ejecutadas con resultado, capturas de la pantalla y estado de los checks. Se deben crear los ocho Issues en GitHub Projects, no solo dejarlos en este Markdown.
