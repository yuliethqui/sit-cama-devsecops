# Aplicación móvil SIT-CAMA

Frontend conectado a los contratos existentes de NestJS: login, menú por rol,
registro/triaje inicial, búsqueda exacta y censo de camas. Ver la
[guía de Docker, pruebas, Android y archivos cambiados](../../docs/frontend.md).

HU-05/HU-06: MEDICO puede asignar/liberar y SERVICIOS completar limpieza desde
el censo, con confirmaciones y control de conflictos. Ver el
[informe de contratos y pruebas](../../docs/HU-05-HU-06.md).

El proyecto utiliza Angular 22. Requiere Node `^22.22.3`, `^24.15.0` o
`>=26.0.0`; Node `22.15.0` no puede ejecutar su CLI. La versión fijada en
`.nvmrc` es `22.23.5`.

Para generar el APK debug que conecta al Docker del equipo desde el emulador:
ejecutar `.\android-debug.cmd`. Ver [causa del aviso, seguridad y pasos Android](../../docs/android-debug.md).
Usar exclusivamente cuentas/datos ficticios. Release conserva el requisito de HTTPS.

Desde PowerShell, en `apps/mobile`:

```powershell
.\serve.cmd
```

La aplicación se sirve en `http://localhost:8100`. Detener con `Ctrl+C`.
Para compilar desde esta misma carpeta, ejecutar `.\build.cmd`.
Este comando también selecciona el Node local compatible automáticamente y
genera la aplicación en `www`.
Ambos comandos utilizan Node `22.23.5` de `.tools/node-v22.23.5-win-x64` si está
disponible; en caso contrario utiliza el Node instalado en el sistema.

La distribución local se descargó de `https://nodejs.org/dist/v22.23.5/` y
se verificó su SHA256 contra `SHASUMS256.txt`. `.tools` no se incluye en Git.
En otra máquina, instalar una versión compatible desde
[Node.js](https://nodejs.org/en/download), abrir una terminal nueva y ejecutar:

```powershell
npm.cmd ci
.\serve.cmd
```
