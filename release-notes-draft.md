# NextStepAI Voice v1.1.1 - Maintenance Release

Esta actualización amplía la experiencia de dictado local en Windows con correcciones de estabilidad, optimizaciones internas y mejoras en el proceso de distribución.

## Novedades

* fix: detecta ECONNRESET envuelto en TypeError 'terminated' como error transitorio

## Instaladores

* **Legacy x64:** recomendado para actualizaciones automáticas y máxima compatibilidad.
* **AVX2 x64:** descarga opcional para procesadores modernos compatibles con AVX2.

ONNX Runtime mantiene selección dinámica de optimizaciones compatibles durante la ejecución.

## Actualización desde v1.1.0

La actualización conserva la configuración, preferencias, historial local y modelos descargados. El canal automático utiliza el instalador Legacy x64 para evitar incompatibilidades de CPU.

## Privacidad

El audio y las transcripciones continúan procesándose localmente. NextStepAI Voice no requiere cuentas ni servicios externos de transcripción.

## Verificación

Cada instalador incluye archivos .sha256 y .blockmap. Los instaladores actuales no tienen firma Authenticode; Windows puede mostrar una advertencia de editor desconocido.