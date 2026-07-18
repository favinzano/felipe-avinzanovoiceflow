# Diseño: defaults de velocidad para captura-transcripción-pegado

Fecha: 2026-07-17

## Objetivo

El flujo de captura → transcripción → pegado se percibe sustancialmente más lento que soluciones comparables (Handy, Aztec Voice, OpenWhispr), a pesar de que la arquitectura del pipeline ya está bien construida (helper de pegado persistente, modelo pre-calentado en segundo plano, streaming de audio en chunks de 40ms). La auditoría del código confirmó que el problema no es arquitectónico: la aplicación arranca, de fábrica, con la combinación de configuración más lenta posible — `whisper-large-v3-turbo` con `num_beams: 3` corriendo en CPU, sin usar la GPU disponible en Windows a través de DirectML, que el propio código ya soporta pero no activa por defecto.

Este cambio ajusta los valores por defecto de `inferenceDevice` y `whisperProfile` para instalaciones nuevas, y migra de forma segura a los usuarios existentes que nunca los cambiaron manualmente, sin tocar el resto del pipeline (helper de pegado, streaming de audio, IPC).

## Alcance

Dentro de alcance:
- Nuevo perfil de Whisper `balanced`: mismo modelo `onnx-community/whisper-large-v3-turbo` que el perfil `accurate` actual, con `num_beams: 1` en vez de `3`.
- Nuevo default `whisperProfile: "balanced"` (reemplaza a `"accurate"`).
- Nuevo default `inferenceDevice: "dml"` (reemplaza a `"cpu"`) para instalaciones nuevas en Windows; en macOS/Linux la normalización existente (`platform-capabilities.cjs`) ya reduce esto a `"cpu"` automáticamente.
- Migración de un solo uso para usuarios existentes que siguen en los defaults antiguos exactos (`cpu` + `accurate`), siguiendo el mismo patrón que `upgradeAccuracyDefault()` en `data-migrations.cjs`.
- Validación con el harness de benchmark ya existente en el repo (`npm run benchmark:models`, `docs/PERFORMANCE_BENCHMARK.md`) contra los gates ya documentados (p50 ≤1.5s, p95 ≤3s, WER ≤110% del baseline).

Fuera de alcance (decisiones ya tomadas explícitamente durante el diseño):
- No se toca el helper de pegado nativo (`tools/FelipeAvinzano.VoiceFlow.PasteHelper/Program.cs`) ni sus esperas de 50ms/120ms — son secundarias frente al ahorro esperado en inferencia.
- No se implementa detección real de GPU dedicada vs. renderizador por software (WARP). En Windows sin GPU dedicada, DirectML podría caer a WARP y ser más lento que CPU sin que el código actual lo detecte como fallo (solo detecta fallos de inicialización, no de rendimiento). Se acepta este riesgo para esta fase; queda como mejora futura si el benchmark muestra que afecta a una porción relevante de usuarios.
- No se migra a un motor de transcripción nativo (whisper.cpp/sherpa-onnx). El repo ya tiene scaffolding para esto (`src/native-transcription-host.cjs`, harness de benchmark), pero es una migración de mayor esfuerzo que queda como Fase 2 si los nuevos defaults no alcanzan los gates de rendimiento.

## Cambios de configuración

`src/whisper-profiles.cjs`: se añade un tercer perfil sin eliminar los existentes.

- `fast`: sin cambios (`whisper-base`, `num_beams: 1`).
- `balanced` (nuevo): `whisper-large-v3-turbo`, `dtype: "q8"`, `num_beams: 1`.
- `accurate`: sin cambios (`whisper-large-v3-turbo`, `num_beams: 3`), sigue disponible para quien priorice precisión máxima.
- `DEFAULT_WHISPER_PROFILE` pasa de `"accurate"` a `"balanced"`.

`src/renderer.js` (objeto `defaults`, línea ~120): `whisperProfile: "balanced"`, `inferenceDevice: "dml"`. La normalización existente (`normalizeInferenceDevice`, `platform-capabilities.cjs`) ya reduce `"dml"` a `"cpu"` en plataformas no-Windows, así que no hace falta lógica condicional adicional en el objeto de defaults.

UI: se añade la opción `balanced` al `<select id="whisperProfile">` correspondiente en el HTML, con una etiqueta corta (ej. "Balanceado") junto a "Rápido" y "Máxima precisión".

## Migración para usuarios existentes

`persistState()` (`renderer.js:280-289`) escribe el objeto `settings` completo a `voice-state.json` en cada cambio, así que los usuarios que ya han abierto la app tienen `inferenceDevice` y `whisperProfile` guardados explícitamente con los valores antiguos. Cambiar solo el objeto `defaults` no los afecta: hace falta una migración explícita sobre el estado persistido.

Se añade `upgradePerfDefault(state)` a `src/data-migrations.cjs`, siguiendo el mismo patrón que `upgradeAccuracyDefault()`:

- Marcador de una sola ejecución: `PERF_DEFAULT_MARKER = "voice-perf-default-v1"`.
- Condición de migración: `settings.inferenceDevice === "cpu"` (o ausente) **y** `settings.whisperProfile === "accurate"` (o ausente) — es decir, el usuario nunca tocó ninguno de los dos ajustes desde Configuración avanzada.
- Si la condición se cumple, se actualizan ambos valores a `"dml"` y `"balanced"` en el estado persistido.
- Si el usuario cambió cualquiera de los dos manualmente (a cualquier valor, incluyendo volver a poner el valor antiguo a propósito), no se toca nada.
- Se marca como ejecutada una sola vez, igual que el resto de migraciones del archivo.

Limitación aceptada: si un usuario entró alguna vez a "modo avanzado" pero dejó ambos campos en su valor original, la migración no puede distinguir eso de "nunca los tocó" y migra igual. Es la misma ambigüedad que ya acepta `upgradeAccuracyDefault()` en producción; no es un riesgo nuevo introducido por este cambio.

Punto de invocación: en `initializeApp()` (`renderer.js:1148-1166`), inmediatamente después de `const persisted = await voiceAPI.getState();` y antes del merge `settings = { ...defaults, ...persisted.settings }`, para que la migración opere sobre el estado ya migrado desde `localStorage` legado (evita duplicar lógica de lectura de storage).

Se muestra un toast informativo una sola vez tras aplicar la migración: *"Activamos aceleración por GPU y un modo balanceado de velocidad. Puedes cambiarlo en Configuración."*

## Manejo de errores

No se introduce manejo de errores nuevo: se reutiliza la red de seguridad ya existente en `transcription-service.cjs:116-126`, que reintenta automáticamente en CPU si la inicialización de DirectML falla. La migración en sí es una operación local sobre JSON ya validado por `normalizeState()` (`local-state.cjs`); si falla la escritura, se comporta igual que cualquier otro fallo de `persistState()` hoy (se registra en consola, no bloquea el arranque).

## Pruebas

- `src/data-migrations.test.cjs`: casos nuevos para `upgradePerfDefault()` — usuario en defaults antiguos exactos se migra; usuario que cambió `inferenceDevice` o `whisperProfile` no se toca; la migración es idempotente (correr dos veces no vuelve a aplicar cambios ni sobreescribe una elección posterior del usuario); el marcador persiste correctamente.
- Test de resolución de perfiles (`whisper-profiles` o `transcription-service.test.cjs` según dónde vivan hoy) para cubrir el nuevo perfil `balanced` y el nuevo `DEFAULT_WHISPER_PROFILE`.
- `npm test` completo antes de cerrar el cambio (regla del proyecto).
- Validación de rendimiento con `npm run benchmark:models` comparando `balanced+dml` contra `accurate+cpu` (baseline actual) usando un corpus privado de 20-30 WAV en español (`benchmarks/corpus/manifest.json`, a crear siguiendo `docs/PERFORMANCE_BENCHMARK.md` — hoy no existe en el repo). Confirmar contra los gates ya documentados: p50 ≤1.5s, p95 ≤3s para audio de hasta 10s, WER ≤110% del baseline.
