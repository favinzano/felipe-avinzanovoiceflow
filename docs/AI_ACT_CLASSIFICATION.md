# Memo de clasificación — Reglamento de IA de la Unión Europea

Fecha de evaluación: 17 de julio de 2026

Responsable: Felipe Avinzano

Producto evaluado: felipe avinzano VoiceFlow beta

Próxima revisión obligatoria: antes de publicar y ante cualquier cambio de finalidad o modelo

## Conclusión provisional

VoiceFlow es un sistema de dictado de finalidad general que ejecuta localmente modelos Whisper para convertir voz en texto. Con las funciones actuales, no realiza identificación biométrica, categorización biométrica, inferencia de emociones, perfilado, evaluación de elegibilidad ni decisiones sobre personas. No se destina a un uso de alto riesgo de los anexos del Reglamento (UE) 2024/1689.

La interfaz informa antes del primer uso que emplea IA, que el procesamiento es local y que la transcripción puede contener errores. Esto respalda la transparencia frente a personas que interactúan con un sistema de IA.

La salida reproduce o limpia una entrada aportada por el usuario. La transcripción y las correcciones estándar que no alteran sustancialmente el significado encajan razonablemente en la excepción de transparencia del artículo 50(2) para edición asistida. Esta conclusión es provisional y debe revisarse jurídicamente antes de que las obligaciones pertinentes sean aplicables el 2 de agosto de 2026.

## Finalidad prevista y límites

- Dictado y transcripción de voz de propósito general.
- Procesamiento local, sin envío del audio o texto al desarrollador.
- Resultado sujeto a revisión humana.
- Prohibido presentarlo como transcripción certificada o como sustituto único en usos médicos, jurídicos, financieros, de seguridad o emergencia.
- No destinado a menores de 18 años en esta beta.

## Controles implantados

- Aviso de IA previo al primer acceso al micrófono.
- Indicador y temporizador visibles durante la grabación.
- Aviso para obtener autorización al grabar a terceros.
- Términos que exigen revisión humana y limitan usos de alto riesgo.
- Documentación del modelo y perfiles en la aplicación.
- Cero telemetría y ausencia de backend del producto.

## Factores que obligan a reabrir la evaluación

Bloquear el lanzamiento de una versión hasta revisar este memo si se añade cualquiera de los siguientes elementos:

- resumen, redacción generativa o manipulación que cambie sustancialmente el significado;
- evaluación, puntuación o recomendación sobre personas;
- identificación biométrica, categorización o inferencia de emociones;
- uso previsto en empleo, educación, crédito, salud, justicia, fronteras, servicios esenciales o seguridad;
- publicación de contenido sintético que pueda confundirse con contenido auténtico;
- modelos remotos, cuentas, sincronización o tratamiento en un backend;
- marketing que cambie la finalidad prevista o prometa una precisión cuantificada.

## Evidencia y gobernanza

Conservar con cada release: capturas del aviso inicial e indicador de grabación, versión de Términos, inventario de modelos, pruebas de red, matriz de afirmaciones y capacitación básica del responsable sobre límites, privacidad y supervisión humana. Registrar aquí fecha, cambio y decisión de cada revisión.

Este memo es una evaluación de producto, no un dictamen legal. Requiere aprobación escrita del abogado de tecnología/consumo antes de abrir la beta global.
