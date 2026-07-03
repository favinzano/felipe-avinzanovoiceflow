# NextStepAI Voice 1.0.0

> Identidad anterior: NextStepAI Voice. Los nombres conservados en este documento corresponden a artefactos publicados antes del cambio a felipe avinzano VoiceFlow.

NextStepAI Voice 1.0.0 es el primer lanzamiento para Windows x64 de nuestro
asistente de dictado privado basado en Whisper. La aplicación transforma voz en
texto localmente, se mantiene disponible desde la bandeja del sistema y permite
dictar en cualquier aplicación con `Ctrl+Shift+Space`.

## Novedades destacadas

### Dictado local y privado

- Inferencia local con Whisper Base o Whisper Large v3 Turbo mediante
  `@huggingface/transformers` y ONNX Runtime.
- Audio, transcripciones, historial y diccionario personal almacenados
  localmente.
- Sin cuentas, telemetría ni proveedores de transcripción en la nube.
- Pegado automático del texto en la aplicación activa y atajo
  `Ctrl+Alt+Space` para reprocesar la última grabación.

### Auto-Start nativo de Windows

- Inicio automático con Windows, habilitado en el primer arranque de la versión
  empaquetada.
- Arranque silencioso con `--hidden`, sin abrir la ventana principal.
- Registro inmediato de atajos globales y disponibilidad desde la bandeja del
  sistema.
- Ajuste **Iniciar con Windows** para activar o desactivar esta función desde la
  interfaz.

### Experiencia de escritorio

- Overlay flotante que indica el estado de grabación sin robar el foco.
- Perfiles Rápido y Máxima Precisión para alternar entre Whisper Base y Large v3 Turbo.
- Captura PCM sin compresión mediante AudioWorklet, evitando la pérdida acústica
  introducida por MediaRecorder/Opus.
- Recorte conservador del silencio inicial y final antes de ejecutar Whisper.
- CPU por defecto y DirectML experimental con fallback automático a CPU.
- Atajos globales configurables con rollback si Windows rechaza el cambio.
- Métricas visibles de latencia, factor de tiempo real y memoria.
- Búsqueda y exportación JSON del historial local.
- VAD adaptativo con parada automática después de hablar.
- Persistencia versionada con escritura atómica, backup y recuperación.
- Helper Windows x64 para captura de foco y pegado mediante APIs Win32.
- Benchmark reproducible con WER, latencia y factor de tiempo real.
- Limpieza opcional, formato hablado, diccionario personal e historial local.
- Cierre a la bandeja para mantener el dictado disponible en segundo plano.

## Optimización frente a OpenWhispr

La versión 1.0.0 incorpora aprendizajes de una revisión competitiva de
OpenWhispr, pero mantiene una implementación independiente y deliberadamente
enfocada en Windows x64.

| Área | Enfoque de NextStepAI Voice 1.0.0 |
| --- | --- |
| Alcance | Dictado local de baja fricción, centrado en Windows x64 |
| Privacidad | Inferencia, historial y preferencias locales; sin cuentas ni telemetría |
| Inicio | Auto-Start nativo y arranque silencioso directo a la bandeja |
| Empaquetado | Solo binarios ONNX Runtime de Windows x64; exclusión de otras arquitecturas, cachés y modelos de desarrollo |
| Operación offline | Los modelos descargados se reutilizan desde `userData` sin requerir conexión posterior |
| Validación | Pruebas aisladas de modelos, integridad de descargas y comportamiento del paquete instalado |

OpenWhispr ofrece un alcance más amplio y multiplataforma. NextStepAI Voice
prioriza una superficie más pequeña, auditable y especializada para dictado
local en Windows. No existe afiliación ni compatibilidad implícita entre ambos
proyectos.

## Compilación y confiabilidad

- Empaquetado ASAR con los binarios nativos x64 de ONNX Runtime desempaquetados
  para que Windows pueda cargar sus archivos `.dll` y `.node`.
- Exclusión de binarios ARM64, Linux y macOS, además de cachés y archivos
  `.onnx` descargados durante el desarrollo.
- Conservación de los binarios x64 necesarios para CPU y DirectML; CPU permanece
  como opción predeterminada y DirectML se ofrece como aceleración experimental.
- Pruebas de humo de modelos con caché temporal aislada, `device: "cpu"` y
  `dtype: "fp32"`.
- Verificación de integridad y tamaño de modelos descargados antes de aprobar
  una prueba.
- Pipeline de firma preparado con SignTool, SHA-256 y timestamp RFC 3161.

## Validación de lanzamiento

- Pruebas unitarias y de preferencias.
- Pruebas de inferencia y modelos locales.
- Verificación del contenido del paquete y ausencia de modelos filtrados.
- Prueba del arranque oculto a la bandeja y del comportamiento de cierre.

## Artefacto

- Instalador objetivo: `NextStepAI-Voice-Setup-1.0.0-x64.exe`.
- Plataforma soportada: Windows x64.
- Los modelos se descargan en el primer uso y no forman parte del instalador.

## Limitaciones conocidas

- DirectML es experimental y puede volver automáticamente a CPU si el hardware,
  driver o modelo no son compatibles.
- El primer dictado requiere conexión para descargar el modelo seleccionado.
- La firma pública del instalador requiere el certificado de producción.
- Antes de declarar el lanzamiento estable deben completarse la matriz de
  aceptación humana, la validación en hardware adicional y una prueba completa
  de actualización y rollback.
