# Corpus De Benchmark

Añade archivos WAV mono PCM de 16 bits y un `manifest.json`:

```json
{
  "candidates": [
    {
      "id": "candidate-model",
      "model": "organization/model-name",
      "dtype": "q8",
      "modelType": "ctc",
      "generation": {}
    }
  ],
  "cases": [
    {
      "id": "es-plan-01",
      "audio": "es-plan-01.wav",
      "language": "spanish",
      "reference": "Auditar el estado actual y mapear cada debilidad a cambios concretos."
    }
  ]
}
```

Ejecuta `npm run benchmark:models`. El reporte incluye WER, latencia y factor de
tiempo real para cada perfil integrado y cada candidato declarado. Usa
`modelType: "ctc"` para motores que no aceptan los parámetros de idioma y tarea
de Whisper.
