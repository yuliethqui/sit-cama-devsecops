# SIT-CAMA | Incremento 01 (base API y plan final)

**Tema actual azul/blanco:** identidad institucional azul sobre el diseño existente,
con colores semánticos conservados. Ver [archivos, pruebas y capturas](docs/TEMA-AZUL.md).

**Incremento 05 · Rediseño visual:** tema, navegación responsive y pantallas
renovadas, con contratos, JWT/RBAC y seguridad Android conservados.
Ver [informe, pruebas, capturas y limitaciones](docs/INCREMENTO-05-VISUAL.md).
La corrección puntual de paginación de auditoría fue autorizada después del cierre
visual y ya está verificada: 168 pruebas API y 35 E2E aprobados. Único cambio
funcional: orden numérico del ID existente, conservando la respuesta JSON.

**Frontend Ionic disponible:** login y navegación por rol, registro/triaje inicial,
búsqueda exacta y censo con filtros. Para el navegador usar el override
`compose.dev.yaml`. Consultar [puesta en marcha, pruebas, Android y alcance](docs/frontend.md).
**HU-05/HU-06:** asignación/liberación exclusiva de MEDICO y limpieza por SERVICIOS implementadas y verificadas localmente. Ver [contratos, pruebas y límites](docs/HU-05-HU-06.md). La difusión subsegundo del censo y el DoD global siguen pendientes.

**HU-02/HU-08:** panel MEDICO con avisos Socket.IO autorizados, reconexión y sonido optativo de 3 segundos; consulta AUDITOR con filtros, cursor y campos limitados. Ver [informe verificable, endpoints, APK y prueba manual](docs/HU-02-HU-08.md). Pruebas locales con PostgreSQL y emulador Android aprobadas. No implica validación clínica ni aceptación del DoD global.

**Actualización HU-01/HU-03:** ya están implementados el registro persistente de pacientes y triaje, cifrado AES-256-GCM, búsqueda exacta por HMAC y auditoría transaccional. Ver [configuración, permisos, pruebas y ejemplos PowerShell](docs/HU-01-HU-03.md). No se modifican tablas ni datos existentes. Los resultados siguen siendo de demostración; III–V requieren protocolo clínico aprobado.

**Repo de destino:** `yuliethqui/sit-cama-devsecops` · **Fecha límite:** 16 de noviembre de 2026 · **Alcance final:** 8 HU + APK Android + evidencias DevSecOps.

Este paquete se debe **extraer en la raíz del repositorio existente**. No toca el `Dockerfile`, `src/`, `test/` o `.github/workflows/sign-image.yml` del experimento original. No se ha escrito en GitHub desde ChatGPT (acceso de lectura únicamente).

## Qué contiene realmente este primer incremento

- Esqueleto NestJS con endpoint `GET /api/health`.
- Login JWT con Argon2id y guardas por roles (`POST /api/auth/login`). Las cuentas se crean localmente; **no** hay credenciales predeterminadas.
- Clasificación de triaje **solo de demostración** mediante `POST /api/triage/preview`, con reglas de referencia para I y II, probadas; III–V permanecen pendientes de protocolo clínico aprobado.
- Censo de 38 camas por servicio `GET /api/beds` y acción `POST /api/beds/:code/complete-cleaning`, protegidos por rol; auditados en la misma transacción.
- PostgreSQL con esquema, índices para impedir asignaciones dobles activas, bitácora protegida frente a UPDATE/DELETE normales y datos sintéticos de camas.
- Docker Compose y base para un nuevo workflow Gitleaks + pruebas + Semgrep + Trivy + compilación Docker.
- Documentación de backlog, límites, riesgos y plan hasta el 16 de noviembre.

**NO está terminado aún:** clasificación clínica completa I–V, reclasificación por especialista con motivo, validación de búsqueda bajo carga acordada, difusión subsegundo del censo, entrega garantizada de alertas, auditoría de todas las operaciones futuras, validación Android física y despliegue release con HTTPS real, borradores offline, SAST/DAST de la solución integrada y Cosign/Syft del contenedor nuevo. Estos requisitos siguen en el plan.

## Primer uso en Windows PowerShell

```powershell
# 1. Clonar el repositorio real y crear una rama (no trabajar sobre main).
git clone https://github.com/yuliethqui/sit-cama-devsecops.git
cd sit-cama-devsecops
git switch -c feature/HU-07-scaffold

# 2. Extraer el ZIP de este incremento EN ESTE DIRECTORIO.
#    Se puede hacer con el Explorador o desde PowerShell:
Expand-Archive -Path "C:\RUTA\sit-cama-incremento-01.zip" -DestinationPath . -Force

# 3. Anexar las reglas de .gitignore.mvp al .gitignore ya existente.
Get-Content .gitignore.mvp | Add-Content .gitignore

# 4. Crear archivo local .env. Edite sus campos antes de arrancar.
Copy-Item .env.example .env

# 5. Instalar dependencias de la API y GENERAR package-lock.json.
cd apps/api
npm install
npm run test:cov
npm run build
cd ../..
```

### Contraseñas de pruebas

En PowerShell se puede generar un secreto aleatorio seguro usando:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes)
```

Generar un valor distinto para `POSTGRES_PASSWORD` y `JWT_SECRET` en `.env` (al menos 32 caracteres para JWT). **No subir .env**.

### Levantar el servidor

```powershell
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

La inicialización SQL se ejecuta automáticamente al crear un volumen PostgreSQL nuevo. Si ya existía `pgdata`, ejecutar la migración de forma controlada; **no** utilizar `docker compose down -v` si contienen datos que se deban conservar.

### Crear una cuenta de DEMOSTRACIÓN (sin contraseñas en código)

La base de datos queda accesible solo desde `127.0.0.1:5432`. En la terminal local:

```powershell
cd apps/api
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '5432'
$env:PGDATABASE = 'sitcama'
$env:PGUSER = 'sitcama'
$env:PGPASSWORD = 'VALOR_QUE_PUSISTE_EN_ENV'
$env:DEMO_SEED_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host 'Contraseña de demo' -AsSecureString)).Password
npm run db:seed-user -- enfermero@demo.test ENFERMERO
```

Use una clave de prueba de al menos 12 caracteres y no la incluya en commits. El valor se solicita en la terminal sin mostrarlo en pantalla. Para otros roles cambie el correo y el rol (`MEDICO`, `SERVICIOS`, `AUDITOR`, `ADMISIONES` o `COORDINADOR`). No usar datos reales de pacientes.

### Probar JWT, roles y triaje

```powershell
$body = @{ email='enfermero@demo.test'; password=$env:DEMO_SEED_PASSWORD } | ConvertTo-Json
$session = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/auth/login' -Method Post -ContentType 'application/json' -Body $body
$headers = @{ Authorization = "Bearer $($session.access_token)" }
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/beds' -Headers $headers
$triage = @{ spo2=84; glasgow=15; eva=2; paroInminente=$false; dolorToracicoTipico=$false } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/triage/preview' -Method Post -Headers $headers -ContentType 'application/json' -Body $triage
```

## Antes del primer Pull Request

1. Verificar que el `package-lock.json` generado dentro de `apps/api/` esté incluido y que `npm ci`, `npm run test:cov` y `npm run build` pasen sin errores.
2. Añadir `apps/api/package-lock.json` al commit. **Sin él fallarán GitHub Actions y el Dockerfile**, por diseño reproducible.
3. Instalar el hook local con `pip install pre-commit; pre-commit install`. Revisar y corregir alertas de Gitleaks/Semgrep/Trivy. No omitirlas para obtener una ejecución verde.
4. Configurar en GitHub Rulesets/Branch protection: PR obligatorio, una aprobación, checks requeridos, no permitir force push.
5. El workflow **previo** `sign-image.yml` sigue construyendo el Dockerfile viejo. Antes de la entrega final, moverlo a un archivo documental o actualizarlo para construir `apps/api/Dockerfile` y firmar la imagen correcta. Conservar capturas y enlaces de sus ejecuciones pasadas.
6. La cobertura ahora abarca `src` salvo el arranque `main.ts`, incluyendo la configuración HTTP y los módulos, con umbral global de 80 %. La integración requiere PostgreSQL y verifica HTTP, persistencia y regresiones; consultar `docs/HU-01-HU-03.md`.

## Siguientes incrementos

Consultar `docs/plan-entrega.md`, `docs/backlog.md` y `docs/android.md`. No presentar este ZIP como las ocho HU ya terminadas ni como un APK listo.
