# Estrategia De Actualización Y Rollback

## Actualización Automática

1. Incrementar la versión semántica en `package.json`.
2. Ejecutar la suite de producción, firma y checklist manual.
3. Crear un GitHub Release estable en `favinzano/felipe-avinzanovoiceflow`.
4. Adjuntar el instalador, su `.exe.blockmap` y `latest.yml`.
5. Confirmar que una instalación anterior detecta, descarga e instala la nueva versión.

La aplicación busca actualizaciones en segundo plano al iniciar. También permite iniciar una búsqueda manual desde el menú de la bandeja.

## Rollback

1. Conservar los dos instaladores estables anteriores.
2. Desinstalar la versión problemática sin eliminar datos locales.
3. Instalar la versión estable anterior.
4. Verificar que preferencias, historial y caché de modelos sigan disponibles.

## Reglas

- No publicar `latest.yml` sin el instalador y `.blockmap` correspondientes.
- No cambiar formatos de almacenamiento local sin migración.
- No borrar datos locales durante actualización o desinstalación por defecto.
- Cambios incompatibles requieren respaldo y migración probada.
- Una versión no se publica si falla la instalación sobre la versión anterior.
