# felipe avinzano VoiceFlow

Aplicacion de escritorio para convertir voz en texto con Whisper ejecutado localmente.

## Instalación En Windows

Para usuarios finales, utiliza el instalador versionado `felipe-avinzanovoiceflow-Setup-1.1.8-x64.exe`.

El archivo `Iniciar felipe avinzano VoiceFlow.bat` se mantiene únicamente para desarrollo local.

## Funciones

- Grabacion desde el microfono.
- Dos modos locales multilenguaje: Whisper Base para velocidad y Whisper Large v3 Turbo para máxima precisión.
- Inferencia por CPU o DirectML experimental con recuperacion automatica a CPU.
- Atajos globales configurables para grabar y reprocesar.
- Pegado automatico o copia al portapapeles.
- Limpieza opcional del texto y diccionario personal.
- Historial local configurable, buscable y exportable.
- Metricas locales de latencia, factor de tiempo real y memoria.
- Parada automatica mediante VAD local adaptativo.
- Persistencia versionada con backup y recuperacion local.
- Pegado mediante helper Windows x64 y fallback explicito al portapapeles.
- Guia rapida, diagnostico y preferencias avanzadas.
- Burbuja flotante que no roba el foco al usar el atajo global.

## Ejecutar

```powershell
npm install
npm run build
npm start
```

La primera transcripcion de cada modo descarga su modelo Whisper. Despues queda almacenado en la cache local y la inferencia se realiza en el equipo. Al cambiar de modo, la aplicacion libera el modelo anterior de la memoria.

Si una descarga queda incompleta o dañada, abre `Soporte` y selecciona `Reparar modelos`.

## Estado de produccion

La versión `1.1.8` es la versión actual para Windows x64. Consulta `PRODUCTION_READINESS.md` y `docs/RELEASE_CHECKLIST.md` antes de publicar un instalador.

## Soporte

Reporta incidencias en `https://github.com/favinzano/felipe-avinzanovoiceflow/issues`. Los diagnósticos copiados desde la aplicación no incluyen transcripciones.
