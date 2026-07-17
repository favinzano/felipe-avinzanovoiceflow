# Evaluación documentada de GDPR

Fecha: 17 de julio de 2026

Responsable de la evaluación: Felipe Avinzano

Producto: felipe avinzano VoiceFlow beta gratuita

## Alcance provisional

La beta tiene acceso global, incluida la Unión Europea, sin campañas ni cobros específicos por país. Por prudencia, el proyecto trata el GDPR como potencialmente aplicable a las actividades de Felipe relacionadas con usuarios europeos, aunque el núcleo de VoiceFlow se ejecuta localmente y no transmite el contenido al proveedor.

El audio, las transcripciones, el historial, el diccionario y las preferencias permanecen bajo control del usuario en su equipo. Felipe no determina fines ni medios de un tratamiento remoto de ese contenido y no puede acceder a él. Hugging Face y GitHub reciben metadatos de red normales bajo sus propias funciones y políticas cuando prestan descarga o soporte.

La información que un usuario envíe voluntariamente a `legal@felipeavinzano.com` o GitHub sí puede constituir tratamiento por Felipe como responsable: datos de contacto, contenido del mensaje, diagnóstico elegido por el usuario e historial de respuesta.

## Inventario y bases previstas

| Actividad | Datos | Finalidad | Base provisional | Retención |
|---|---|---|---|---|
| Responder soporte o solicitudes de derechos | Contacto y contenido enviado voluntariamente | Responder, mantener y proteger el producto | Ejecución de solicitud/contrato e interés legítimo; obligación legal cuando aplique | Mientras sea necesario para resolver y documentar, luego eliminación según calendario legal |
| Avisos legales o disputas | Identidad, contacto y comunicaciones | Cumplir Términos y defender derechos | Contrato y obligaciones/intereses legales | Durante el asunto y prescripción aplicable |
| Datos locales del producto | Audio, texto, historial, diccionario, preferencias | Dictado y preferencias locales | No se transmiten ni quedan bajo acceso de Felipe mediante VoiceFlow | Hasta borrado local por el usuario |

No se usa consentimiento como base genérica para la Política de privacidad. La aceptación registrada corresponde al contrato de Términos. No existen decisiones automatizadas sobre personas, publicidad comportamental, venta de datos ni entrenamiento con contenido del usuario.

## Minimización, seguridad y derechos

- No hay cuenta, telemetría, analítica, crash reporting remoto ni backend del producto.
- El diagnóstico copiable excluye transcripciones y requiere una acción voluntaria para compartirlo.
- La acción de eliminación local borra los archivos personales conocidos y reinicia la aplicación; la caché de modelos se controla aparte.
- Las solicitudes sobre datos que Felipe realmente posea se reciben en `legal@felipeavinzano.com`, se verifican proporcionalmente y se registran con fecha y respuesta.
- La Política explica que Felipe no puede acceder, exportar o borrar datos que nunca recibió.
- Antes de abrir la beta debe existir un calendario operativo de retención para email/soporte, control de acceso y procedimiento de incidentes.

## DPO, representante y transferencias

Con el alcance actual no se observa monitoreo regular y sistemático a gran escala, tratamiento a gran escala de categorías especiales ni actividad central que haga necesario un DPO; no se nombrará uno salvo cambio del producto o conclusión distinta del abogado.

La necesidad de un representante en la UE bajo el artículo 27 depende, entre otros factores, de si el tratamiento relacionado con la oferta es ocasional, de bajo riesgo y no incluye gran escala de categorías especiales. La arquitectura local apoya la excepción, pero la oferta global y el soporte deben ser revisados por abogado antes del lanzamiento. Esta evaluación no da por resuelta la excepción.

La información enviada voluntariamente a soporte puede llegar a Estados Unidos y a los proveedores elegidos por el usuario. Antes de incorporar proveedores propios o tratamiento sistemático se deben documentar roles, contratos, mecanismo de transferencia y medidas complementarias.

## Decisión y disparadores

Estado: **provisional; requiere aprobación legal antes de beta pública**. No se requiere DPIA por las funciones actuales de dictado local de propósito general, pero se reabrirá la evaluación antes de añadir cuentas, backend, sincronización, analítica, publicidad, crash reporting, pagos, marketing dirigido a la UE, menores, categorías especiales a escala, decisiones sobre personas o modelos remotos.

Conservar junto a esta evaluación: versión de la aplicación y políticas, diagrama de datos, inventario de red, prueba canaria, registro de proveedores, calendario de retención, procedimiento de derechos y aprobación escrita del abogado.
