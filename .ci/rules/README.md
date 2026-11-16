# SAST rule snapshot

`owasp-javascript.json` is an unmodified subset of JavaScript/TypeScript rules
downloaded from https://semgrep.dev/c/p/owasp-top-ten on 2026-11-14.
Rule IDs, messages, patterns and original metadata (including licenses) are retained.
Source: Semgrep, https://github.com/semgrep/semgrep-rules.
License: **Semgrep Rules License v1.0**, https://semgrep.dev/legal/rules-license.
This academic, non-service use must retain that attribution. Re-evaluate the license
before redistribution as a competing scanning service. The local JSON snapshot
avoids silently downloading changed registry rules on each CI run.

`sitcama.yml` adds PostgreSQL request-input taint and TLS validation controls.
Static SQL fragments/column allowlists are not themselves SQL injection; the local
positive control verifies request input reaching the SQL argument is rejected.
No rules are suppressed in application source. Backend and frontend src are scanned.
