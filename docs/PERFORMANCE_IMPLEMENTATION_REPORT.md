# Informe de implementación de rendimiento

## Resultado implementado

Se instrumentó el flujo completo con reloj monotónico y retención local de 200 muestras: cierre/flush de captura, preprocesado, IPC, espera del modelo, inferencia, limpieza, portapapeles, foco, pegado e historial. No se almacena audio, texto ni hash del contenido.

La ruta actual solapa la preparación de Whisper con la grabación, transmite PCM cada 40 ms, espera el acuse real del AudioWorklet, escribe el portapapeles una vez, pega antes de encolar el historial y mantiene el helper Windows caliente. La espera de foco de 120 ms pasó a sondeo acotado; se conservan 50 ms posteriores a `SendInput` para evitar una `v` suelta.

## Medición disponible

Equipo: Intel i7-8700, NVIDIA RTX 3050, 64 GB RAM, Windows x64. Operación medida: captura del handle de la aplicación destino, sin inyectar texto.

| Ruta | Repeticiones | p50 | p95 |
|---|---:|---:|---:|
| Helper por proceso | 20 | 214.22 ms | 344.87 ms |
| Helper persistente caliente | 100 | 0.16 ms | 0.64 ms |

El primer arranque del host persistente midió 358.10 ms; ahora se inicia durante el arranque de VoiceFlow para sacarlo del camino del primer atajo. Ejecutar `npm run benchmark:input-helper` para repetir la medición.

## Resultado pendiente, sin fabricar cifras

No existe aún `benchmarks/corpus/manifest.json` ni el corpus privado de 20–30 WAV. Por ello no se reportan todavía p50/p95 fin-a-pegado, WER, RTF o RAM comparables para VoiceFlow, Handy, OpenWhispr, Aztec Voice, whisper.cpp y Parakeet. `docs/PERFORMANCE_BENCHMARK.md` contiene el procedimiento y `npm run benchmark:evaluate` impide promover un motor sin todos los gates.

Hasta disponer de esa evidencia, Automático conserva Transformers.js/Whisper como fallback y ningún paquete nativo nuevo se convierte en predeterminado.
