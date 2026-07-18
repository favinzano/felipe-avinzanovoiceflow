# Inventario de conexiones y datos

Versión: 1 — 17 de julio de 2026

La regla del producto es denegar cualquier nuevo servicio de red hasta documentarlo y probar que no recibe audio, transcripciones, historial ni diccionario. La inferencia no requiere un endpoint remoto.

| Finalidad | Servicio y hosts esperados | Datos enviados por VoiceFlow | Datos que no deben enviarse | Momento |
|---|---|---|---|---|
| Descargar modelos Whisper | Hugging Face: `huggingface.co`, `*.hf.co`, `cdn-lfs.huggingface.co`, `*.xethub.hf.co` y redirecciones de entrega propiedad del proveedor | Petición de archivos, metadatos HTTP normales, IP visible para el proveedor | Audio, transcripciones, historial, diccionario, preferencias | Primera preparación de cada modelo, reparación o ausencia en caché |
| Comprobar actualizaciones | GitHub: `api.github.com`, `github.com` | Identidad/versionado normal del cliente de actualización, canal, plataforma, arquitectura, IP visible | Audio, transcripciones, historial, diccionario | Después de aceptar Términos y en comprobación manual |
| Descargar una actualización | GitHub Releases y entrega: `github.com`, `objects.githubusercontent.com`, `release-assets.githubusercontent.com` | Solicitud del instalador y metadatos HTTP normales | Audio, transcripciones, historial, diccionario | Solo cuando hay una versión compatible |
| Soporte voluntario | `github.com` o cliente de correo elegido por el usuario | Solo lo que el usuario decida escribir o adjuntar fuera de VoiceFlow | Ninguna carga automática | Al pulsar soporte/contacto |

## Procedimiento de validación por release

1. Usar una instalación y carpeta de datos limpias en cada sistema operativo.
2. Capturar DNS, hosts, método, ruta, cabeceras y tamaño mediante una herramienta local de inspección de red autorizada.
3. Aceptar Términos; verificar que antes de aceptar no hay descarga de modelo ni comprobación de actualización.
4. Descargar Whisper Base y Large v3 Turbo, comprobar actualización y abrir soporte.
5. Buscar en requests y cuerpos una frase canaria dictada, una entrada canaria del diccionario y una transcripción canaria. El resultado exigido es cero coincidencias.
6. Comparar todos los hosts con esta tabla. Un host no inventariado bloquea la release hasta investigar y actualizar código, política y tabla.
7. Archivar captura, fecha, versión, sistema operativo y firma del revisor con los artefactos del release.

No hay analítica, publicidad, crash reporting remoto ni endpoints propios aprobados. La prueba automatizada de cumplimiento rechaza dependencias directas conocidas de esas categorías; la captura manual verifica el comportamiento efectivo y las dependencias transitivas.
