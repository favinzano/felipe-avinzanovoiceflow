# felipe avinzano VoiceFlow

Aplicación de escritorio multiplataforma (Windows, macOS y Linux) para convertir voz en texto con Whisper ejecutado 100% localmente. El audio y las transcripciones nunca salen del equipo: no hay cuentas, autenticación ni servicios de IA en la nube.

## Instalación

Los instaladores de cada versión están en [Releases](https://github.com/favinzano/felipe-avinzanovoiceflow/releases/latest):

| Plataforma | Instalador | Notas |
|---|---|---|
| Windows x64 | `felipe-avinzanovoiceflow-Setup-1.1.8-AVX2-x64.exe` | Recomendado en CPUs modernas (2013+). Único con actualización automática. |
| Windows x64 (Legacy) | `felipe-avinzanovoiceflow-Setup-1.1.8-Legacy-x64.exe` | Para CPUs sin soporte AVX2. Descarga manual, sin auto-actualización. |
| macOS (Apple Silicon) | `felipe-avinzanovoiceflow-Setup-1.1.8-arm64.dmg` | Build nativo arm64. |
| macOS (Intel) | `felipe-avinzanovoiceflow-Setup-1.1.8-x64.dmg` | Build nativo x64. |
| Linux x86_64 | `felipe-avinzanovoiceflow-Setup-1.1.8-x86_64.AppImage` | Ejecutable portable, no requiere instalación. |

Ninguno de los instaladores tiene firma de código (Windows sin Authenticode, macOS sin notarización de Apple):

- **Windows** mostrará la advertencia de SmartScreen "editor desconocido" — usa "Más información" → "Ejecutar de todas formas".
- **macOS** puede bloquear la apertura vía Gatekeeper — clic derecho → Abrir, o `xattr -d com.apple.quarantine` sobre el `.dmg` descargado.

El archivo `Iniciar felipe avinzano VoiceFlow.bat` se mantiene únicamente para desarrollo local en Windows.

## Funciones

- Grabación desde el micrófono, con parada automática mediante VAD local adaptativo.
- Dos perfiles de calidad: Whisper Base (velocidad) y Whisper Large v3 Turbo (máxima precisión).
- Cinco idiomas de transcripción: español, inglés, francés, alemán y portugués.
- Inferencia por CPU o DirectML experimental en Windows, con recuperación automática a CPU.
- Atajos globales configurables, en dos modos: alternar (inicia/detiene con cada pulsación) o mantener presionado (solo Windows).
- Pegado automático en la app activa o copia al portapapeles, con reintento y aviso explícito si el pegado falla.
- Limpieza opcional del texto transcrito y diccionario personal de reemplazos.
- Historial local configurable, buscable y exportable.
- Métricas locales de latencia, factor de tiempo real y memoria utilizada.
- Persistencia versionada con backup y recuperación local.
- Guía rápida, diagnóstico copiable (sin transcripciones) y preferencias avanzadas.
- Burbuja flotante que no roba el foco al usar el atajo global.
- Actualización automática vía GitHub Releases (Windows, canal AVX2).

## Ejecutar desde el código fuente

```powershell
npm install
npm run build
npm start
```

La primera transcripción de cada modo descarga su modelo Whisper. Después queda almacenado en la caché local y la inferencia se realiza en el equipo. Al cambiar de modo, la aplicación libera el modelo anterior de la memoria.

Si una descarga queda incompleta o dañada, abre `Soporte` y selecciona `Reparar modelos`.

Antes de dar por cerrado un cambio, corre `npm test`.

## Estado de producción

La versión `1.1.8` es la versión actual para Windows x64. La misma versión de código se empaqueta para macOS y Linux. Consulta `PRODUCTION_READINESS.md` y `docs/RELEASE_CHECKLIST.md` antes de publicar un instalador.

## Soporte

Reporta incidencias en `https://github.com/favinzano/felipe-avinzanovoiceflow/issues`. Los diagnósticos copiados desde la aplicación no incluyen transcripciones.
