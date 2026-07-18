# Checklist Manual De Release

> La publicación está subordinada a `docs/LEGAL_RELEASE_GATE.md`. Un estado BLOQUEADA impide distribuir la build aunque las pruebas técnicas pasen.

## Antes De Construir

- [ ] `docs/LEGAL_RELEASE_GATE.md` está APROBADA y tiene evidencia de buzón comercial, URLs públicas y revisión escrita del abogado.
- [ ] El número de versión coincide en `package.json` y la interfaz.
- [ ] El árbol Git está limpio.
- [ ] `npm test` pasa.
- [ ] `npm run test:production` pasa.
- [ ] `npm run test:models` pasa con Base y Large v3 Turbo.
- [ ] `npm run release:test-models` confirma que el ejecutable empaquetado no intenta obtener modelos remotos cuando falta un paquete offline.
- [ ] `npm run release:test-installer` pasa.
- [ ] `npm audit --omit=dev` no reporta vulnerabilidades.

## Instalador

- [ ] NSIS en Windows 10/11 x64 muestra nombre, icono y licencia correctos.
- [ ] DMG en macOS Apple Silicon e Intel abre y ejecuta la arquitectura correcta.
- [ ] AppImage en Linux x86_64 abre en X11 y Wayland.
- [ ] La instalación limpia funciona en Windows 10 x64.
- [ ] La instalación limpia funciona en Windows 11 x64.
- [ ] El inicio automático funciona tras iniciar sesión en Windows, macOS y Linux, y puede desactivarse desde Preferencias.
- [ ] La aplicación inicia sin Node.js instalado.
- [ ] La actualización sobre la versión anterior conserva datos.
- [ ] La desinstalación elimina la aplicación.
- [ ] La desinstalación conserva datos locales por defecto.
- [ ] El rollback a la versión estable anterior funciona.

## Funcional

- [ ] Permiso de micrófono y selección de dispositivo.
- [ ] Atajo global inicia y termina grabación en Windows, macOS y Linux; macOS solicita Accesibilidad cuando corresponde.
- [ ] Overlay no roba el foco.
- [ ] Pegado funciona en editores, navegador y suite ofimática nativos de cada plataforma, incluyendo Linux X11 y Wayland.
- [ ] DirectML y “mantener para hablar” sólo aparecen en Windows; macOS/Linux conservan CPU y modo alternar al importar preferencias.
- [ ] Whisper Base se instala desde un paquete local verificado, transcribe y queda en caché.
- [ ] Whisper Large v3 Turbo se instala desde un paquete local verificado, transcribe y queda en caché.
- [ ] Validar modelos detecta una caché dañada y la reemplaza únicamente mediante un paquete local firmado por hash.
- [ ] Historial, diccionario y preferencias persisten tras reiniciar.
- [ ] Una instalación limpia no contiene historial de desarrollo o prerelease.
- [ ] La X pregunta la primera vez; ocultar a bandeja, salir y recordar elección funcionan.
- [ ] Emails, URLs, muletillas, silencios y textos largos cumplen aceptación.

## Validación Técnica Del Motor Local

> Alcance vigente: perfil Rápido con Whisper Base y perfil Máxima Precisión con Whisper Large v3 Turbo. La aplicación no incluye Whisper Tiny.

### Primer Arranque E Instalación Local Del Modelo

Ejecutar cada perfil con una caché limpia y la red deshabilitada. Instalar el paquete offline validado y registrar por separado el tiempo de instalación y el tiempo hasta que aparece la primera transcripción.

- [ ] Confirmar desde `Soporte > Diagnóstico` la ruta de caché dentro de `userData\models`.
- [ ] Ejecutar `Validar modelos` o eliminar únicamente la caché de modelos antes de cada medición.
- [ ] Abrir la aplicación, seleccionar el perfil a medir y registrar RAM disponible, uso de RAM del proceso y hora inicial.
- [ ] Presionar `Ctrl+Shift+Space`, dictar una frase controlada de 5 a 10 segundos y detener la grabación.
- [ ] El overlay permanece visible y muestra progreso de preparación local sin bloquear ni cerrar la aplicación.
- [ ] La primera transcripción finaliza correctamente y el texto se entrega una sola vez.
- [ ] La caché contiene archivos `.onnx` completos; manifiesto y hashes coinciden con el paquete offline aprobado.
- [ ] No quedan archivos parciales ni una caché reutilizable si se interrumpe la instalación local.
- [ ] Registrar para Base y Large v3 Turbo: tamaño del paquete, duración de instalación, tiempo de inicialización, pico de RAM y resultado.
- [ ] Criterio de aceptación: tres primeros arranques consecutivos por perfil terminan sin error, fuga de memoria ni intervención manual.

### Persistencia De Caché Y Operación Offline

Ocultar la ventana en la bandeja conserva el proceso y normalmente mantiene el modelo cargado en RAM. Salir por completo y reiniciar el sistema operativo obliga a reconstruir el modelo en memoria, pero no debe requerir una fuente externa.

- [ ] Tras una transcripción correcta, anotar el tamaño y fecha de modificación de `userData\models`.
- [ ] Ocultar la aplicación en la bandeja, esperar cinco minutos y volver a dictar con el mismo perfil.
- [ ] La segunda transcripción inicia sin reinstalación y su latencia es comparable con una transcripción en caliente.
- [ ] Salir completamente de felipe avinzano VoiceFlow y deshabilitar red, Wi-Fi y adaptadores virtuales.
- [ ] Iniciar nuevamente la aplicación y transcribir con cada perfil previamente descargado.
- [ ] Base y Large v3 Turbo cargan desde `userData\models` y transcriben correctamente sin acceso a red.
- [ ] No cambian el tamaño ni la fecha de los archivos ONNX durante la prueba offline.
- [ ] Reiniciar Windows, macOS y Linux con la red deshabilitada y repetir una transcripción con ambos perfiles.
- [ ] Ningún proceso intenta comprobar actualizaciones, telemetría ni modelos en la red durante la prueba.
- [ ] Criterio de aceptación: diez transcripciones offline consecutivas por perfil, después de un reinicio completo, terminan sin solicitudes de red ni errores del motor.

### Alternancia De Perfiles Y Memoria

Validar con Administrador de tareas/Performance Monitor, Monitor de Actividad o las herramientas equivalentes de Linux. Medir memoria residente y memoria disponible del sistema para el proceso de VoiceFlow.

- [ ] Cerrar otras aplicaciones intensivas y registrar la memoria base de felipe avinzano VoiceFlow antes de cargar un modelo.
- [ ] Cargar Base, completar una transcripción y registrar memoria estable después de 60 segundos.
- [ ] Cambiar a Large v3 Turbo y transcribir; confirmar que Base se libera antes de terminar la carga.
- [ ] Esperar 60 segundos y registrar memoria estable de Large v3 Turbo.
- [ ] Cambiar nuevamente a Base; confirmar que Large v3 Turbo se libera y que la aplicación sigue respondiendo.
- [ ] Repetir el ciclo `Base -> Large v3 Turbo -> Base` diez veces sin cerrar la aplicación.
- [ ] No existen dos perfiles ONNX activos simultáneamente después de estabilizar cada cambio.
- [ ] La memoria residente puede permanecer por encima del valor inicial por cachés del runtime, pero no crece de forma monotónica entre ciclos equivalentes.
- [ ] Tras volver a Base y esperar 60 segundos, la memoria residente queda dentro de un margen del 20% respecto a la primera medición estable de Base.
- [ ] Cada sistema mantiene respuesta normal: sin paginación sostenida, congelamientos, cierre inesperado ni degradación progresiva del tiempo de transcripción.
- [ ] Criterio de aceptación: los diez ciclos terminan correctamente y la memoria del último ciclo permanece dentro del margen definido.

### Evidencia Obligatoria

- [ ] Adjuntar tabla de resultados por equipo con CPU, RAM, sistema y arquitectura, perfil, tiempos y picos de memoria.
- [ ] Adjuntar captura o exportación del monitor de rendimiento usado en cada plataforma.
- [ ] Adjuntar registro de actividad de red de la prueba offline.
- [ ] `npm run build:native` genera el helper Windows x64 autocontenido.
- [ ] El paquete contiene y firma `FelipeAvinzano.VoiceFlow.PasteHelper.exe`.
- [ ] Los paquetes macOS/Linux contienen los bindings correctos de ONNX Runtime, `better-sqlite3` y `libnut` para su plataforma y arquitectura.
- [ ] El VAD respeta pausas menores al periodo de gracia y finaliza después de silencios mayores.
- [ ] `voice-state.json` se recupera correctamente desde su backup.
- [ ] `npm run release:verify-acceptance` aprueba al menos doce casos humanos: cuatro de Windows, cuatro de macOS y cuatro de Linux.
- [ ] Documentar cualquier desviación, reproducción y decisión de aceptación antes de publicar la versión.

## Publicación

- [ ] Ejecutable e instalador firmados.
- [ ] Checksum SHA-256 publicado.
- [ ] Política de privacidad, términos, licencia y avisos incluidos.
- [ ] Notas de release publicadas.
- [ ] Canal de soporte confirmado.
