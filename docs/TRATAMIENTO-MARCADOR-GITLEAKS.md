# Tratamiento del marcador sintético histórico de Gitleaks

La referencia local `origin/feature/test-secret` contiene una regla educativa propia, `sit-cama-demo-secret`, y un marcador ficticio en `src/config.js`. El diagnóstico identificó ese marcador sin mostrar su valor. La configuración del MVP usa los detectores predeterminados y no incorpora la regla educativa histórica; por ello sus resultados deben distinguirse.

Se conserva el historial completo y se documentan commit, ruta, línea, regla y hashes en [el registro auditable](integration/gitleaks-historical-marker.json). No se añadieron `.gitleaksignore`, exclusiones generales ni comentarios de supresión. La configuración `.gitleaks.toml` del MVP se copió íntegra.

## Propuesta pendiente de aprobación

1. Ejecutar el escaneo predeterminado del historial y de archivos actuales, con redacción total, sin atribuir cobertura de archivos no versionados al escaneo Git.
2. Ejecutar separadamente la configuración histórica sobre el historial; conservar su salida no cero si detecta el marcador. Es un hallazgo del experimento, no un escaneo aprobado.
3. Contrastar cada resultado con la combinación exacta commit/ruta/línea/regla y SHA-256 del marcador. Comprobar su naturaleza sintética y que no exista una credencial real reutilizada.
4. Si se decide activar esa regla en el gate general, someter a revisión del responsable de seguridad únicamente las huellas exactas emitidas por Gitleaks para esos hallazgos históricos. Cualquier excepción sería posterior, específica, documentada y aprobada; no está aplicada en esta integración.
5. Conservar una prueba positiva de la regla y de los detectores reales. No suprimir otras coincidencias ni modificar historial para obtener un resultado verde.

La presencia de un marcador sintético no permite declarar seguro todo el historial. Los resultados de esta integración se presentan por configuración y alcance en el informe, incluidos escaneos bloqueados o fallidos.
