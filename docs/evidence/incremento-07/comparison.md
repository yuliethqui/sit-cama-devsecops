# Comparación generada desde reportes Trivy y paquetes de los contenedores

| Perfil | CRITICAL | HIGH | MEDIUM | LOW | UNKNOWN | Total | Paquetes Debian | SBOM |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| bookworm | 1 | 38 | 95 | 85 | 5 | 224 | 88 | 3469 |
| trixie | 0 | 48 | 85 | 64 | 5 | 202 | 79 | 2921 |
| distroless | 0 | 0 | 39 | 12 | 2 | 53 | 14 | 1681 |
| final | 0 | 0 | 39 | 12 | 2 | 53 | 14 | 1681 |

Los números HIGH/CRITICAL son pares paquete–CVE; los 39 originales contienen 12 CVE distintos. No se aplicó VEX ni se ignoraron vulnerabilidades sin parche.

| CVE original | Severidad | Pares originales | Paquetes | Versión corregida en informe original | Pares presentes en escaneo final |
|---|---|---:|---|---|---:|
| CVE-2026-53613 | HIGH | 8 | bsdutils 1:2.38.1-5+deb12u3<br>libblkid1 2.38.1-5+deb12u3<br>libmount1 2.38.1-5+deb12u3<br>libsmartcols1 2.38.1-5+deb12u3<br>libuuid1 2.38.1-5+deb12u3<br>mount 2.38.1-5+deb12u3<br>util-linux 2.38.1-5+deb12u3<br>util-linux-extra 2.38.1-5+deb12u3 | No indicada | 0 |
| CVE-2026-53615 | HIGH | 8 | bsdutils 1:2.38.1-5+deb12u3<br>libblkid1 2.38.1-5+deb12u3<br>libmount1 2.38.1-5+deb12u3<br>libsmartcols1 2.38.1-5+deb12u3<br>libuuid1 2.38.1-5+deb12u3<br>mount 2.38.1-5+deb12u3<br>util-linux 2.38.1-5+deb12u3<br>util-linux-extra 2.38.1-5+deb12u3 | No indicada | 0 |
| CVE-2026-78410 | HIGH | 8 | bsdutils 1:2.38.1-5+deb12u3<br>libblkid1 2.38.1-5+deb12u3<br>libmount1 2.38.1-5+deb12u3<br>libsmartcols1 2.38.1-5+deb12u3<br>libuuid1 2.38.1-5+deb12u3<br>mount 2.38.1-5+deb12u3<br>util-linux 2.38.1-5+deb12u3<br>util-linux-extra 2.38.1-5+deb12u3 | No indicada | 0 |
| CVE-2026-41992 | HIGH | 1 | gzip 1.12-1 | No indicada | 0 |
| CVE-2026-54369 | HIGH | 1 | libacl1 2.3.1-3 | No indicada | 0 |
| CVE-2025-6020 | HIGH | 4 | libpam-modules 1.5.2-6+deb12u2<br>libpam-modules-bin 1.5.2-6+deb12u2<br>libpam-runtime 1.5.2-6+deb12u2<br>libpam0g 1.5.2-6+deb12u2 | No indicada | 0 |
| CVE-2026-16742 | HIGH | 2 | libsystemd0 252.39-1~deb12u2<br>libudev1 252.39-1~deb12u2 | No indicada | 0 |
| CVE-2025-69720 | HIGH | 3 | libtinfo6 6.4-4<br>ncurses-base 6.4-4<br>ncurses-bin 6.4-4 | No indicada | 0 |
| CVE-2026-9538 | HIGH | 1 | perl-base 5.36.0-7+deb12u4 | No indicada | 0 |
| CVE-2023-45853 | CRITICAL | 1 | zlib1g 1:1.2.13.dfsg-1 | No indicada | 0 |
| CVE-2026-76844 | HIGH | 1 | zlib1g 1:1.2.13.dfsg-1 | No indicada | 0 |
| CVE-2026-85091 | HIGH | 1 | zlib1g 1:1.2.13.dfsg-1 | No indicada | 0 |

El detalle de versiones finales y aplicabilidad de los 39 pares está en blocking-before-after.csv / .json. Los riesgos de la zlib embebida de Node se conservan aparte; un escaneo limpio no aprueba la publicación.
