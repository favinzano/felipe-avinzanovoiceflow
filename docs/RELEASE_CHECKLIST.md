# Checklist Manual De Release

## Antes De Construir

- [ ] El número de versión coincide en `package.json` y la interfaz.
- [ ] El árbol Git está limpio.
- [ ] `npm test` pasa.
- [ ] `npm run test:production` pasa.
- [ ] `npm run test:models` pasa con Base y Large v3 Turbo.
- [ ] `npm run release:test-models` pasa desde el ejecutable empaquetado.
- [ ] `npm run release:test-installer` pasa.
- [ ] `npm audit --omit=dev` no reporta vulnerabilidades.

## Instalador

- [ ] El instalador muestra nombre, icono y licencia correctos.
- [ ] La instalación limpia funciona en Windows 10 x64.
- [ ] La instalación limpia funciona en Windows 11 x64.
- [ ] Los accesos directos de escritorio e Inicio funcionan.
- [ ] La aplicación inicia sin Node.js instalado.
- [ ] La actualización sobre la versión anterior conserva datos.
- [ ] La desinstalación elimina la aplicación.
- [ ] La desinstalación conserva datos locales por defecto.
- [ ] El rollback a la versión estable anterior funciona.

## Funcional

- [ ] Permiso de micrófono y selección de dispositivo.
- [ ] Atajo global inicia y termina grabación.
- [ ] Overlay no roba el foco.
- [ ] Pegado funciona en Bloc de notas, navegador, Office y un editor de código.
- [ ] Whisper Base descarga, transcribe y queda en caché.
- [ ] Whisper Large v3 Turbo descarga, transcribe y queda en caché.
- [ ] Reparar modelos elimina una caché dañada y permite descargar nuevamente.
- [ ] Historial, diccionario y preferencias persisten tras reiniciar.
- [ ] Una instalación limpia no contiene historial de desarrollo o prerelease.
- [ ] La X pregunta la primera vez; ocultar a bandeja, salir y recordar elección funcionan.
- [ ] Emails, URLs, muletillas, silencios y textos largos cumplen aceptación.

## Validación Técnica Del Motor Local

> Alcance de `1.0.0`: perfil Rápido con Whisper Base y perfil Máxima Precisión con Whisper Large v3 Turbo. Esta versión no incluye Whisper Tiny.

### Primer Arranque Y Descarga Del Modelo

Ejecutar cada perfil con una caché limpia y una conexión de red estable. Registrar por separado el tiempo de descarga y el tiempo desde que termina la descarga hasta que aparece la primera transcripción.

- [ ] Confirmar desde `Soporte > Diagnóstico` la ruta de caché dentro de `userData\models`.
- [ ] Ejecutar `Reparar modelos` o eliminar únicamente la caché de modelos antes de cada medición.
- [ ] Abrir la aplicación, seleccionar el perfil a medir y registrar RAM disponible, uso de RAM del proceso y hora inicial.
- [ ] Presionar `Ctrl+Shift+Space`, dictar una frase controlada de 5 a 10 segundos y detener la grabación.
- [ ] El overlay permanece visible y muestra progreso de preparación sin bloquear ni cerrar la aplicación.
- [ ] La primera transcripción finaliza correctamente y el texto se entrega una sola vez.
- [ ] La caché contiene archivos `.onnx` completos; `npm run test:models` confirma sus tamaños contra Hugging Face.
- [ ] No quedan archivos parciales ni una caché reutilizable si la red se interrumpe durante la descarga.
- [ ] Registrar para Base y Large v3 Turbo: velocidad de red, duración total, tiempo de inicialización posterior a la descarga, pico de RAM y resultado.
- [ ] Criterio de aceptación: tres primeros arranques consecutivos por perfil terminan sin error, fuga de memoria ni intervención manual.

### Persistencia De Caché Y Operación Offline

Ocultar la ventana en la bandeja conserva el proceso y normalmente mantiene el modelo cargado en RAM. Salir por completo y reiniciar Windows obliga a reconstruir el modelo en memoria, pero no debe volver a descargarlo.

- [ ] Tras una transcripción correcta, anotar el tamaño y fecha de modificación de `userData\models`.
- [ ] Ocultar la aplicación en la bandeja, esperar cinco minutos y volver a dictar con el mismo perfil.
- [ ] La segunda transcripción inicia sin progreso de descarga y su latencia es comparable con una transcripción en caliente.
- [ ] Salir completamente de felipe avinzano VoiceFlow y deshabilitar red, Wi-Fi y adaptadores virtuales.
- [ ] Iniciar nuevamente la aplicación y transcribir con cada perfil previamente descargado.
- [ ] Base y Large v3 Turbo cargan desde `userData\models` y transcriben correctamente sin acceso a Hugging Face.
- [ ] No cambian el tamaño ni la fecha de los archivos ONNX durante la prueba offline.
- [ ] Reiniciar Windows con la red deshabilitada y repetir una transcripción con ambos perfiles.
- [ ] La posible falla de comprobación de actualizaciones no impide iniciar, cargar el modelo ni transcribir offline.
- [ ] Criterio de aceptación: diez transcripciones offline consecutivas por perfil, después de un reinicio completo, terminan sin solicitudes de descarga ni errores del motor.

### Alternancia De Perfiles Y Memoria

Validar con Administrador de tareas, Monitor de recursos o Performance Monitor. Medir `Working Set`, `Private Bytes` y memoria disponible del sistema para `felipe avinzano VoiceFlow.exe`.

- [ ] Cerrar otras aplicaciones intensivas y registrar la memoria base de felipe avinzano VoiceFlow antes de cargar un modelo.
- [ ] Cargar Base, completar una transcripción y registrar memoria estable después de 60 segundos.
- [ ] Cambiar a Large v3 Turbo y transcribir; confirmar que Base se libera antes de terminar la carga.
- [ ] Esperar 60 segundos y registrar memoria estable de Large v3 Turbo.
- [ ] Cambiar nuevamente a Base; confirmar que Large v3 Turbo se libera y que la aplicación sigue respondiendo.
- [ ] Repetir el ciclo `Base -> Large v3 Turbo -> Base` diez veces sin cerrar la aplicación.
- [ ] No existen dos perfiles ONNX activos simultáneamente después de estabilizar cada cambio.
- [ ] El working set puede permanecer por encima del valor inicial por cachés del runtime y administración de memoria de Windows, pero no crece de forma monotónica entre ciclos equivalentes.
- [ ] Tras volver a Base y esperar 60 segundos, `Private Bytes` queda dentro de un margen del 20% respecto a la primera medición estable de Base.
- [ ] Windows mantiene respuesta normal: sin paginación sostenida, congelamientos, cierre inesperado ni degradación progresiva del tiempo de transcripción.
- [ ] Criterio de aceptación: los diez ciclos terminan correctamente y la memoria del último ciclo permanece dentro del margen definido.

### Evidencia Obligatoria

- [ ] Adjuntar tabla de resultados por equipo con CPU, RAM, versión de Windows, perfil, tiempos y picos de memoria.
- [ ] Adjuntar captura o exportación de Performance Monitor de la prueba de alternancia.
- [ ] Adjuntar registro de actividad de red de la prueba offline.
- [ ] `npm run build:native` genera el helper Windows x64 autocontenido.
- [ ] El paquete contiene y firma `FelipeAvinzano.VoiceFlow.PasteHelper.exe`.
- [ ] El VAD respeta pausas menores al periodo de gracia y finaliza después de silencios mayores.
- [ ] `voice-state.json` se recupera correctamente desde su backup.
- [ ] `npm run release:verify-acceptance` aprueba los doce casos humanos.
- [ ] Documentar cualquier desviación, reproducción y decisión de aceptación antes de publicar `1.0.0`.

## Publicación

- [ ] Ejecutable e instalador firmados.
- [ ] Checksum SHA-256 publicado.
- [ ] Política de privacidad, términos, licencia y avisos incluidos.
- [ ] Notas de release publicadas.
- [ ] Canal de soporte confirmado.
