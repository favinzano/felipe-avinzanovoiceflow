# Puerta legal de publicación

Estado al 17 de julio de 2026: **BLOQUEADA para beta pública**.

El código contiene los controles técnicos, pero ninguna build puede ponerse a disposición de usuarios externos hasta cerrar y archivar todos los elementos siguientes.

## Bloqueos externos obligatorios

- [ ] Confirmar un buzón comercial real en Florida que no sea el domicilio residencial e incorporarlo a Términos, Privacidad y contacto público.
- [ ] Publicar y verificar por HTTPS documentos equivalentes en URLs estables de `felipeavinzano.com`:
  - `https://felipeavinzano.com/voiceflow/legal/terminos`
  - `https://felipeavinzano.com/voiceflow/legal/privacidad`
  - `https://felipeavinzano.com/voiceflow/legal/en/terms`
  - `https://felipeavinzano.com/voiceflow/legal/en/privacy`
  - `https://felipeavinzano.com/voiceflow/legal/contacto`
- [ ] Confirmar que `legal@felipeavinzano.com` recibe y conserva solicitudes, avisos de disputa y opt-outs.
- [ ] Obtener y archivar aprobación escrita de un abogado de tecnología/consumo con experiencia en Florida, arbitraje de consumidores y oferta a consumidores europeos para ambos idiomas, `docs/GDPR_ASSESSMENT.md`, la clasificación del AI Act y el flujo de aceptación.
- [ ] Sustituir este estado por **APROBADA**, con fecha, versión, nombre del abogado/revisor y ubicación de la evidencia.
- [ ] Crear `docs/legal-release-approval.json` a partir del ejemplo y completar evidencia verificable. El workflow de release ejecuta `npm run release:legal-gate`, comprueba que la dirección figure en los cuatro documentos y valida en vivo las cinco URLs; mientras falte o falle, no construye ni publica una release por tag.

## Validación técnica obligatoria

- [ ] Instalación nueva: el micrófono, atajos, actualización y descarga de modelos quedan inactivos hasta aceptar Términos; rechazar cierra la aplicación.
- [ ] Una versión material nueva de Términos pide nueva aceptación; una actualización sin cambio de versión no lo hace.
- [ ] Términos, Privacidad, licencias y memo de IA se leen offline desde Soporte y desde el primer inicio.
- [ ] El indicador y temporizador permanecen visibles durante toda la captura y el aviso de IA aparece antes del primer uso.
- [ ] "Eliminar mis datos personales locales" borra historial, diccionario, preferencias, aceptación y backups sin borrar binarios ni caché de modelos; el reinicio queda limpio.
- [ ] Ejecutar y archivar el procedimiento de `docs/NETWORK_DATA_INVENTORY.md` en Windows, macOS y Linux. Ninguna request contiene contenido canario del usuario y no aparecen hosts no inventariados.
- [ ] Empaquetar y comprobar que las copias ES/EN, la versión `2026-07-17-beta-1`, el aviso de micrófono de macOS y los enlaces HTTPS coinciden.
- [ ] Revisar manualmente que no existen marcadores, emails inoperativos ni direcciones ficticias.

## Puertas de cambio futuro

- **DMCA:** no aplicable mientras VoiceFlow no aloje, sincronice o publique contenido de usuarios. Cualquiera de esas funciones bloquea la release hasta implementar el programa completo de 17 U.S.C. §512, incluido agente, retiro, contranotificación y política de reincidentes.
- **Tiendas:** una publicación en App Store o Google Play queda bloqueada hasta auditoría de SDK, política pública y etiquetas de privacidad/Data Safety exactas.
- **Cobro:** cualquier pago queda bloqueado hasta decidir entidad legal, impuestos, procesador, precios, renovación, cancelación, reembolsos, seguro E&O/cyber y nueva revisión legal.
- **Datos remotos:** cuentas, sincronización, analítica, crash reporting, publicidad o backend requieren evaluación de privacidad, seguridad, contratos/proveedores y actualización de documentos antes de desarrollar el lanzamiento.
- **IA:** cualquier resumen, redacción generativa, decisión sobre personas, biometría o cambio sustancial de significado reabre `docs/AI_ACT_CLASSIFICATION.md`.
