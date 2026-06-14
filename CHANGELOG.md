# Changelog

Todos los cambios relevantes de NextStepAI Voice se documentan en este archivo.

## [1.0.0] - 2026-06-14

Primer lanzamiento candidato para Windows x64.

### Añadido

- Dictado local mediante Whisper Base y Whisper Large v3 Turbo.
- Captura PCM sin compresión mediante AudioWorklet, sin la pérdida introducida
  por MediaRecorder/Opus.
- Perfil Máxima Precisión con Large v3 Turbo Q8 y beam search.
- Atajo global `Ctrl+Shift+Space` para iniciar o detener una grabación.
- Atajo `Ctrl+Alt+Space` para reprocesar la última grabación.
- Pegado automático, overlay flotante, historial local, formato hablado y
  diccionario personal.
- Integración con la bandeja del sistema y cierre en segundo plano.
- Auto-Start nativo de Windows, con arranque silencioso mediante `--hidden`.
- Ajuste **Iniciar con Windows** para controlar el Auto-Start desde la interfaz.
- Configuración inicial que habilita Auto-Start en el primer lanzamiento
  empaquetado.
- Atajos globales configurables con rollback si Windows rechaza el cambio.
- Opción experimental DirectML con fallback automático a CPU.
- Métricas visibles de latencia, factor de tiempo real y memoria.
- Búsqueda y exportación JSON del historial local.
- VAD local adaptativo con parada automática y periodo de gracia configurable.
- Persistencia JSON versionada fuera de `localStorage`, con escritura atómica,
  backup y recuperación.
- Helper Windows x64 autocontenido para captura de foco y pegado mediante APIs
  Win32 directas.
- Benchmark reproducible de modelos con WER, latencia y factor de tiempo real.
- Gate obligatorio de doce casos humanos antes del release firmado.

### Cambiado

- Arquitectura enfocada en dictado local y privado para Windows x64, informada
  por una revisión competitiva frente a OpenWhispr.
- Empaquetado reducido a los binarios ONNX Runtime requeridos para Windows x64.
- Binarios nativos `.dll` y `.node` de ONNX Runtime desempaquetados del archivo
  ASAR para permitir su carga correcta.
- Caché persistente de modelos alojada en `userData` para reutilización offline.
- Inferencia de pruebas forzada a CPU y FP32 para ejecución predecible en CI.

### Privacidad y seguridad

- Audio, modelos, historial, preferencias y transcripciones permanecen locales.
- No se requieren cuentas, telemetría ni servicios de transcripción en la nube.
- Exclusión de cachés de Hugging Face y modelos `.onnx` del instalador.
- Pipeline de firma preparado para SignTool con SHA-256 y timestamp RFC 3161.

### Compilación y lanzamiento

- Exclusión de binarios ONNX Runtime para ARM64, Linux y macOS.
- Conservación de binarios Windows x64 necesarios para CPU y DirectML.
- Verificación del paquete para detectar arquitecturas no deseadas, binarios
  faltantes y modelos filtrados.
- Instalador NSIS x64 con nombre
  `NextStepAI-Voice-Setup-1.0.0-x64.exe`.

### Pruebas y QA

- Pruebas de humo de modelos con caché temporal aislada.
- Verificación del tamaño e integridad de archivos ONNX descargados.
- Pruebas del arranque oculto a la bandeja y del comportamiento de cierre.
- Checklist de cold start, persistencia offline y liberación de memoria.

### Comparación con OpenWhispr

- NextStepAI Voice mantiene una implementación independiente y especializada en
  Windows x64.
- Se prioriza una superficie de producto más pequeña: dictado local, operación
  offline, Auto-Start silencioso y paquete optimizado.
- OpenWhispr conserva un alcance más amplio y multiplataforma; no existe
  afiliación, dependencia de código ni compatibilidad implícita entre ambos
  proyectos.

### Limitaciones conocidas

- La inferencia de v1.0.0 se ejecuta en CPU, aunque el paquete conserva los
  binarios DirectML para trabajo futuro.
- El primer uso de cada modelo requiere una descarga desde la red.
- La publicación estable requiere firma con el certificado de producción,
  aceptación humana en hardware adicional y validación de actualización y
  rollback.
