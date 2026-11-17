# Workflow histórico de Cosign

`sign-image.yml.txt` conserva sin cambios el contenido de `.github/workflows/sign-image.yml` del commit `f66bcd7f608aef2f599cd12dfb3ac1c2a4c0043b`. SHA-256: `64106aa075b0a1c8b8c890e6159ba4e6bd04d2d29b0792732e171240a1118a6f`.

Pertenece al experimento D de construcción, publicación y firma del proyecto Express raíz. Se retiró del directorio de workflows activos porque publicaba en cada push a `main` sin depender de los gates o del bloqueo de publicación del MVP. La extensión `.txt` y su ubicación fuera de `.github/workflows` impiden su activación como workflow.

El historial y las ramas del experimento permanecen intactos. No se ejecutó su publicación ni su firma. El único workflow activo incorporado es `mvp-ci.yml`, cuyo estado de riesgos permanece bloqueado.
