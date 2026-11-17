# Evidencias seleccionadas

Este directorio contiene únicamente la selección revisada del diagnóstico y un resumen derivado de la reejecución API ya confirmada. [El manifiesto parcial](integration-manifest.json) conserva procedencia, fecha, alcance y SHA-256; no representa una copia completa de las carpetas de evidencia del origen.

- `tests/summary.json`, `tests/preservation.json` y `tests/after/audit-observation.json` documentan el incremento 08 histórico: el 200 observado corresponde al defecto anterior a la corrección, no al estado actual.
- `incremento-07/` documenta análisis de la imagen histórica y su base. El SBOM y los digests no se atribuyen al nuevo árbol integrado ni a una nueva compilación. La firma de base no es una firma SIT-CAMA.
- `tema-azul/360/` contiene exclusivamente cuatro capturas ya inspeccionadas, con datos sintéticos. No se incorporaron las demás capturas.
- `api-recheck-2026-11-16/summary.json` conserva 244/244 API y 3/3 de la regresión original, ejecutados antes de esta integración. El resumen omite nombres de pruebas, rutas absolutas y trazas; registra hashes de sus fuentes internas, que no se copiaron.

Los documentos originales de incrementos anteriores se preservan sin reescribir su historia. Algunas referencias apuntan a reportes o capturas fuera de esta selección parcial; esos archivos se omitieron deliberadamente y no se sustituyeron por evidencia ficticia. Los logs y reportes internos de la integración permanecen ignorados en `.reports/`, sin incorporarse al repositorio.
