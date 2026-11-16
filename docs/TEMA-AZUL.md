# SIT-CAMA · Tema azul/blanco

Cambio de paleta sobre el diseño funcional del Incremento 05. Se mantienen
layout, tipografía, espaciado, tamaños, navegación, componentes y responsividad.
Solo cambian declaraciones de color, fondos, bordes y sombras.

## Paleta

| Uso | Color |
| --- | --- |
| Azul institucional / botones | `#1D5FA7` |
| Azul profundo / navegación lateral y login | `#143B63` |
| Azul claro / fondos de acento | `#E9F2FC` |
| Acento / navegación activa | `#DBEAFF` |
| Fondo general gris claro | `#F4F7FB` |
| Superficies | `#FFFFFF` |
| Texto principal / secundario | `#1B2D43` / `#52657A` |

Se reemplazaron los tokens `--green*`/`--lime` por `--primary*`/`--accent`,
con sus equivalentes Ionic. Se retiraron los verdes de la identidad en login,
navegación, botones, formularios, tarjetas, tablas y paneles informativos.

Los colores funcionales se conservan: disponible y éxito verdes; ocupada azul;
limpieza y advertencias ámbar; bloqueada gris; prioridad I y errores rojos;
prioridad II ámbar. Texto, números, símbolos y etiquetas siguen diferenciando
los estados. Los mensajes informativos usan azul; las confirmaciones de
operaciones conservan su verde semántico.

## Archivos modificados

Cuatro archivos de estilos en `apps/mobile`:

- `src/theme/variables.scss`: nueva paleta y tokens Ionic.
- `src/styles/_foundation.scss`: controles, badges, avisos, foco y formularios.
- `src/styles/_navigation.scss`: navegación lateral/inferior, marca y sesión.
- `src/styles/_pages.scss`: login, inicio, registro, búsqueda, camas, panel y auditoría.

Se revisó `src/global.scss`: solo importa estilos Ionic, sin identidad verde
propia; se conserva intacto. No se modificaron HTML, TypeScript, servicios,
rutas, guards, JWT, Socket.IO, backend, DTO, endpoints, esquema, secretos,
configuración Capacitor ni controles de red Android. No se añadieron dependencias.

Documentación/evidencia: este informe, su enlace en `README-MVP.md` y
`docs/evidence/tema-azul/`.

## Verificación web

- `npm run test:unit`: **42 pruebas aprobadas**.
- `npm run test:e2e`: **35/35 aprobados**, incluidos los recorridos de 360, 768
  y 1440 px, teclado, filtros, permisos, registro/búsqueda, camas, panel y auditoría.
- `npm run lint`: ESLint, tipos y formato aprobados.
- `ionic build`: producción aprobada. Se conserva el JavaScript compilado;
  cambia el CSS del tema.
- Revisión visual de las siete pantallas en las capturas generadas. Se guardan
  33 capturas de prueba: [galería](evidence/tema-azul/CAPTURAS.md).

La comparación de declaraciones SCSS confirmó cero cambios de geometría y
conservación de los selectores de estados/prioridades comprobados. Ver
`style-preservation.json` y el respaldo `styles-before.json`. La verificación
por SHA-256 de 137 archivos protegidos confirmó cero cambios; ver
`preservation-result.json`. Las pruebas usan esquemas PostgreSQL privados con
usuarios/pacientes ficticios; sus snapshots confirmaron tablas públicas intactas.

Se calcularon diez combinaciones de contraste (`contrast.json`): botón blanco
sobre azul **6,47:1**, texto secundario **5,58:1**, navegación **8,71:1**,
información **7,67:1** y borde de control **3,40:1**. Todos los pares evaluados
superan 4,5:1 para texto o 3:1 para límites de controles. Esto no implica una
certificación integral de accesibilidad ni prueba con lector de pantalla.

## Android

Compilación `ionic build --configuration android-debug`, `npx cap sync android`,
`:app:assembleDebug` e instalación en emulador aprobadas. Las dos pruebas de
`:app:connectedDebugAndroidTest` pasaron en Android 17/API 37, incluida la política
que restringe HTTP debug al destino local autorizado.

El recorrido existente `node e2e/android-panel-audit.cjs` pasó con el nuevo tema:
login, panel, aviso real I, reconexión TCP, vuelta desde segundo plano, consulta
de auditoría y restricciones SERVICIOS. Se revisaron visualmente sus capturas
del panel y auditoría. Esta prueba utiliza otro esquema privado, reemplaza
brevemente el listener API y restaura Docker al terminar; las tablas públicas
conservaron sus huellas. No se cambiaron datos existentes ni secretos.

También pasaron el build de producción, Capacitor sync y `:app:assembleRelease`.
El APK release mantiene HTTP bloqueado y queda sin firma de distribución; no
se publicó. El último `www`/sync corresponde a producción. El APK debug instalado
conserva su entorno local y el tema azul. No se ha probado un dispositivo físico,
iOS ni una distribución de producción.

Para reconstruir debug con el tema azul, ejecutar desde `apps/mobile`:

```powershell
.\android-debug.cmd
```

Ese helper selecciona el entorno debug, sincroniza Capacitor y genera
`android/app/build/outputs/apk/debug/app-debug.apk`. Utilizar JDK 21/SDK Android
configurados. Para navegar localmente usar `serve.cmd`.

No hay publicación en GitHub ni uso de pacientes reales.
