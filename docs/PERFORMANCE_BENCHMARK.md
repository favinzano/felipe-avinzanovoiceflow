# Benchmark de captura, transcripción y pegado

## Estado

La aplicación registra localmente hasta 200 mediciones sin audio, texto ni identificadores de contenido. El motor predeterminado continúa siendo Transformers.js/Whisper hasta que un candidato pase todos los gates con un corpus privado real. No se declara una mejora numérica antes de ejecutar ese corpus.

## Corpus privado

1. Copiar `benchmarks/corpus/manifest.template.json` a `benchmarks/corpus/manifest.json`.
2. Añadir de 20 a 30 WAV mono PCM de 16 bits, con grupos de 2–5 s, 5–10 s y 10–30 s.
3. Incluir español general, nombres propios y vocabulario técnico.
4. Mantener WAV y `manifest.json` fuera de Git; `.gitignore` ya los excluye.

## Comparación de motores

`npm run benchmark:models` ejecuta una inferencia fría y tres calientes por WAV. Por defecto sólo usa archivos ya presentes. Para preparar deliberadamente el laboratorio se puede establecer `VOICEFLOW_BENCHMARK_ALLOW_DOWNLOADS=1`; esa opción no existe en la aplicación empaquetada.

Los candidatos nativos usan un comando local, sin shell ni red:

```json
{
  "id": "whisper-cpp-q5",
  "command": "C:/ruta/whisper-cli.exe",
  "args": ["-m", "C:/modelos/ggml-large-v3-turbo-q5_0.bin", "-f", "{audio}", "-l", "es"],
  "timeoutMs": 120000
}
```

Para un host que responda JSON, `outputField` puede ser `"text"` o `"result.text"`. El mismo mecanismo sirve para un CLI local de sherpa-onnx/Parakeet.

## Aplicaciones completas y gate

Usar los mismos WAV y español local en VoiceFlow, Handy, OpenWhispr y Aztec Voice. Registrar la liberación del atajo y el momento en que el texto aparece en la aplicación destino. Ejecutar Bloc de notas, un navegador y un editor Electron, con una carga fría y tres repeticiones calientes. Deshabilitar la red para las 100 iteraciones de estabilidad.

Consolidar resultados en una copia de `benchmarks/acceptance.template.json` y ejecutar:

```powershell
npm run benchmark:evaluate -- benchmarks/results/acceptance.json
```

El comando devuelve código 2 y `winner: null` si nadie cumple: p50 ≤ 1.5 s, p95 ≤ 3 s para audio de hasta 10 s, WER ≤ 110% del baseline, paquete ≤ 2 GB, proceso ≤ 3 GB, 100 dictados consecutivos y modo offline. Dentro de un empate de p95 del 5%, decide WER y después tamaño.

## Paquetes offline

Soporte instala carpetas locales con `manifest.json`. Se validan versión mínima, licencia, rutas, tamaños y SHA-256 antes y después de copiar; la publicación final es atómica. Consultar `docs/model-pack-manifest.example.json`. No hay descargas silenciosas.
