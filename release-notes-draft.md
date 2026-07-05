# felipe avinzano VoiceFlow v1.1.3 - Maintenance Release

Esta actualización amplía la experiencia de dictado local en Windows con correcciones de estabilidad, optimizaciones internas y mejoras en el proceso de distribución.

## Novedades

* docs: add project scaffolding docs and auto release notes workflow
* fix: bump to 1\.1\.3 with native shortcut hardening and real audio waveform
* docs: add DESIGN\.md and sync Title scale with shipped CSS
* fix: audit\-driven UI hardening pass on VoiceFlow desktop app
* fix: harden native paste focus targeting and add model load recovery
* fix: apply motion\-quality fixes to recorder and overlay animations
* fix: restore packaged desktop bridge
* fix: make VoiceFlow installer QA transactional
* fix: isolate VoiceFlow migration QA
* fix: complete VoiceFlow release acceptance
* test: complete VoiceFlow rebrand acceptance
* fix: validate brand audit encodings
* fix: harden VoiceFlow brand audit
* fix: exclude generated brand audit paths
* docs: adopt the VoiceFlow product identity
* fix: avoid packaged smoke temp leaks
* fix: harden VoiceFlow release verification
* fix: remove legacy release identifier
* build: rename VoiceFlow release artifacts
* fix: package the VoiceFlow paste helper
* refactor: rename the VoiceFlow paste helper
* fix: preserve VoiceFlow footer accessibility
* fix: harden VoiceFlow wordmark runtime
* feat: style the VoiceFlow wordmark
* fix: validate VoiceFlow migration marker
* fix: stabilize VoiceFlow Electron bootstrap
* fix: preserve legacy session data during migration
* feat: apply VoiceFlow identity in Electron
* fix: stage VoiceFlow migration safely
* fix: harden VoiceFlow data migration
* fix: preserve migrated destination data
* feat: migrate legacy Voice data safely
* feat: define VoiceFlow brand contract
* docs: plan VoiceFlow rebrand implementation
* chore: ignore local worktrees
* docs: define VoiceFlow rebrand design
* fix: aplica reintento de carga de modelo ante bloqueo de antivirus en whisper\-models\.smoke

## Instaladores

* **Legacy x64:** recomendado para actualizaciones automáticas y máxima compatibilidad.
* **AVX2 x64:** descarga opcional para procesadores modernos compatibles con AVX2.

ONNX Runtime mantiene selección dinámica de optimizaciones compatibles durante la ejecución.

## Actualización desde v1.1.0

La actualización conserva la configuración, preferencias, historial local y modelos descargados. El canal automático utiliza el instalador Legacy x64 para evitar incompatibilidades de CPU.

## Privacidad

El audio y las transcripciones continúan procesándose localmente. felipe avinzano VoiceFlow no requiere cuentas ni servicios externos de transcripción.

## Verificación

Cada instalador incluye archivos .sha256 y .blockmap. Los instaladores actuales no tienen firma Authenticode; Windows puede mostrar una advertencia de editor desconocido.

Repositorio: https://github.com/favinzano/felipe-avinzanovoiceflow