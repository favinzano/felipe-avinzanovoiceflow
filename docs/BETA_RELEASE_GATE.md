# Gate De Entrega Para Beta Testers

La entrega beta externa queda aprobada solo cuando se cumplen todos los gates.

## 1. Firma De Codigo

- Certificado Code Signing publico y confiable disponible.
- Secretos `SIGNING_PFX_BASE64` y `SIGNING_PFX_PASSWORD` configurados.
- Workflow `Signed Windows Release` aprobado para Legacy y AVX2.
- `Get-AuthenticodeSignature` devuelve `Valid` para ambos instaladores.
- La firma incluye timestamp RFC 3161.

## 2. Aceptacion Humana

- Copiar `docs/acceptance-results.template.json` a
  `docs/acceptance-results.json`.
- Completar los doce casos con resultados reales.
- Todos los casos deben indicar `status: "passed"`.
- Todos los casos deben indicar `pasteSuccess: true`.
- Ejecutar `npm run release:verify-acceptance`.

## 3. Publicacion

- Generar nuevamente `.blockmap`, `.sha256` y `latest.yml` despues de firmar.
- Mantener Legacy como canal automatico por compatibilidad.
- Publicar AVX2 como descarga opcional.
- Verificar los activos descargados desde GitHub, no solo los archivos locales.
- Marcar la release como estable unicamente despues de completar este documento.

## Estado Actual

- [ ] Certificado Code Signing publico configurado.
- [ ] Matriz humana completada.
- [ ] Legacy firmado y verificado.
- [ ] AVX2 firmado y verificado.
- [ ] Activos firmados publicados.
- [ ] Release promovida de pre-release a estable.
