# Preparación Para Producción

Estado actual: release candidate `1.0.0` funcional para Windows x64. Todavía no debe distribuirse públicamente como versión estable firmada.

## Verificado

- Compilación del renderer y comprobación sintáctica del proceso principal.
- Pipeline local con pruebas de limpieza, muletillas, espacios, emails, URLs y estructura.
- Whisper Base y Whisper Small cargados y probados localmente.
- Filtrado de salidas no verbales y alucinaciones breves conocidas.
- Captura mediante atajo global, overlay sin robo de foco y pegado en la aplicación activa.
- Procesamiento, diccionario e historial locales.
- Icono e identidad visual propios.
- Auditoría de dependencias de producción sin vulnerabilidades de severidad alta o crítica (ver vulnerabilidad moderada conocida y sin corrección en Problemas Conocidos).
- Instalador NSIS reproducible, instalación, arranque y desinstalación validados.
- Ejecutable empaquetado validado con Whisper Base y Whisper Small.
- Caché de modelos persistente en datos del usuario y acción de reparación.
- Checksum SHA-256 generado automáticamente.
- Política de privacidad, términos, licencia y avisos de terceros.
- Estrategia de actualización manual y rollback documentada.
- CI de Windows para validar y construir artefactos.
- Perfil de desarrollo aislado del perfil instalado y limpieza única del historial prerelease.
- Cierre a bandeja con elección recordada, configuración visible y prueba empaquetada.
- Workflow de firma pública que bloquea artefactos Authenticode inválidos.

## Bloqueadores Antes Del Lanzamiento Estable

1. Firmar el ejecutable e instalador con un certificado de firma de código para reducir alertas de SmartScreen.
2. Ejecutar pruebas de aceptación con grabaciones reales:
   - Diferentes voces, acentos, micrófonos y niveles de ruido.
   - Dictados cortos y largos.
   - Emails, URLs, nombres propios y términos técnicos.
   - Medición de precisión, latencia y tasa de pegado exitoso.
3. Probar en Windows 11 y en equipos adicionales con poca memoria y CPU más lenta. Windows 10 x64 ya fue validado en el entorno actual.
4. Validar instalación sobre una versión anterior y rollback cuando exista un segundo instalador versionado.

## Problemas Conocidos

- **`Windows Release Check` puede fallar intermitentemente en `npm run test:models`** al cargar el encoder de Whisper Large v3 Turbo (~2.5 GB) en los runners de Windows de GitHub. La causa raíz es un problema conocido y no resuelto en `@huggingface/transformers` ([issue #1279](https://github.com/huggingface/transformers.js/issues/1279)): su resolución de caché de archivos en Node.js puede fallar entre `cache.put()` y la siguiente `cache.match()`, sin volver al buffer que ya tiene en memoria. El síntoma cambia de forma entre ejecuciones (bloqueo tipo antivirus, lectura de tensor fuera de límites, o "Unable to get model file path or buffer."), pero es la misma causa. No se ha reproducido localmente ni en la autoprueba de carga de modelos de la aplicación empaquetada. Ver los comentarios en `src/model-smoke-utils.cjs` (`withFreshCacheRetry`) antes de seguir investigando. Mitigación actual: reintentos con directorio de caché nuevo en cada intento; una falla aislada aquí debe tratarse como intermitencia conocida (reejecutar el job), no como regresión.

- **`npm audit --omit=dev` reporta 7 vulnerabilidades moderadas heredadas de `@nut-tree-fork/nut-js@4.2.6`** (la última versión publicada) a través de su dependencia fijada a una versión exacta `jimp@0.22.10` → `file-type` ([GHSA-5v7r-6r5c-r473](https://github.com/advisories/GHSA-5v7r-6r5c-r473): bucle infinito en el parser ASF con entrada malformada). No existe todavía una versión corregida («No fix available» según `npm audit`), y como `nut-js` fija `jimp` a una versión exacta, no se puede resolver actualizando ni con `npm audit fix`. Esta aplicación solo usa la API `keyboard` de `nut-js` (ver `src/input-helper.cjs`); la ruta vulnerable (procesamiento de imágenes/captura de pantalla) nunca se invoca. Mitigación actual: el paso de auditoría en CI usa `--audit-level=critical` para no bloquear en este hallazgo moderado y documentado, sin dejar de fallar ante vulnerabilidades altas o críticas futuras. Revisar cuando `file-type` o `@jimp/core` publiquen una versión corregida.

## Comandos De Validación

```powershell
npm test
npm run test:production
npm run test:models
npm run release:win
npm run release:verify
npm run release:test-models
npm run release:test-installer
npm run release:test-tray
npm run release:verify-signature
npm audit --omit=dev --audit-level=critical
```

`npm run test:models` descarga y valida Whisper Base y Whisper Small, por lo que requiere conexión en su primera ejecución.
