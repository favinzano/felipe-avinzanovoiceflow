# Política de privacidad de VoiceFlow

Última actualización: 17 de julio de 2026

Esta Política explica cómo Felipe Avinzano, individuo domiciliado en Florida, Estados Unidos ("Felipe"), trata información en felipe avinzano VoiceFlow. Contacto: `legal@felipeavinzano.com`.

## 1. Diseño local

VoiceFlow es una aplicación de escritorio sin cuentas ni backend del producto. La transcripción con modelos Whisper se ejecuta en su equipo. Felipe no recibe el audio, las transcripciones, el diccionario ni el historial a través de la Aplicación y no tiene acceso remoto a ellos.

VoiceFlow no incluye telemetría, analítica, anuncios, píxeles publicitarios, venta o intercambio de datos, informes automáticos de fallos ni uso del contenido para entrenar modelos.

## 2. Información procesada en su equipo

- **Audio:** se captura en memoria para transcribirlo. La grabación más reciente se conserva temporalmente en memoria para la función "Reprocesar" hasta que otra grabación la sustituya o cierre la Aplicación. No se escribe intencionalmente como archivo de audio.
- **Transcripciones e historial:** se guardan en una base de datos local si el historial está habilitado.
- **Diccionario, micrófono y preferencias:** se guardan en archivos locales, incluida la versión y fecha de aceptación de los Términos.
- **Backups y archivos temporales:** el estado puede tener una copia local de recuperación y archivos temporales durante escrituras seguras.
- **Modelos y caché:** los archivos de los modelos Whisper se descargan y conservan localmente para operar después sin descargarlos otra vez.
- **Portapapeles y exportaciones:** copiar, pegar o exportar coloca información en ubicaciones o aplicaciones elegidas por usted, fuera del control de VoiceFlow.

Estos datos suelen estar en la carpeta de datos de aplicación asignada por el sistema operativo a `felipe avinzano VoiceFlow`; la ruta exacta se muestra en Soporte/Diagnóstico. La caché de modelos se encuentra dentro de esa carpeta, en `models`.

## 3. Conexiones de red

VoiceFlow puede conectarse a:

- **Hugging Face:** para descargar los modelos Whisper y archivos relacionados. Hugging Face y sus redes de distribución reciben metadatos normales de una conexión, como dirección IP, fecha/hora, archivos solicitados y datos del cliente HTTP. VoiceFlow no adjunta audio, transcripciones, historial ni diccionario.
- **GitHub:** para comprobar y, en versiones compatibles, descargar actualizaciones desde GitHub Releases; también para abrir el canal voluntario de soporte. GitHub recibe metadatos normales de red como dirección IP, fecha/hora, versión o cliente y recursos solicitados. Las comprobaciones de actualización no contienen audio, transcripciones, historial ni diccionario.

Los proveedores anteriores tratan esos metadatos bajo sus propias políticas. La transcripción local puede continuar sin red después de haber descargado el modelo, aunque las actualizaciones y nuevas descargas no estarán disponibles.

## 4. Soporte voluntario

El botón de soporte puede abrir GitHub Issues. Los issues pueden ser públicos: no publique grabaciones, transcripciones, datos personales ni información confidencial. El diagnóstico copiable se diseña para no incluir transcripciones, pero usted debe revisarlo antes de compartirlo. La información que envíe voluntariamente por GitHub o email será tratada para responder y mantener la seguridad o calidad del producto, y se conservará mientras sea necesaria para esos fines o por obligaciones legales.

## 5. Retención y eliminación

Los datos locales permanecen hasta que usted los borra. Puede borrar elementos del historial por separado o usar **Soporte > Eliminar mis datos personales locales**, que cierra la base de datos, elimina historial, diccionario, preferencias, aceptación legal, backups y archivos temporales conocidos, y reinicia la Aplicación en estado limpio. Esta acción no borra los binarios instalados ni la caché de modelos; los modelos tienen un control separado en Soporte.

La desinstalación puede conservar la carpeta de datos para permitir recuperación. Use primero la acción de eliminación si desea borrar datos personales locales; después puede desinstalar. Felipe no puede recuperar datos locales borrados ni eliminarlos de forma remota.

## 6. Base jurídica, alcance y derechos

En la medida en que Felipe trate información recibida voluntariamente por soporte, el tratamiento se basa según corresponda en responder su solicitud, ejecutar los Términos, intereses legítimos de soporte y seguridad, y obligaciones legales. La actividad estrictamente local ocurre bajo su control y no se transmite a Felipe.

Según su jurisdicción, puede tener derechos de acceso, corrección, eliminación, oposición, restricción o portabilidad sobre información que Felipe realmente posea, y derecho a presentar una reclamación ante una autoridad. Escríbanos a `legal@felipeavinzano.com`. Verificaremos la solicitud de forma proporcionada. No podemos entregar datos que nunca recibimos ni acceder a los almacenados solo en su equipo.

No vendemos ni compartimos información personal para publicidad comportamental. VoiceFlow no está dirigido a menores de 18 años.

## 7. Seguridad, transferencias y cambios

La arquitectura local reduce transferencias, pero ningún software o equipo es completamente seguro. Proteja su cuenta del sistema, el disco, los backups y el portapapeles. La información que usted envíe a soporte puede tratarse en Estados Unidos y por los proveedores que elija para el envío, sujeta a salvaguardas exigidas por la ley aplicable.

Podemos actualizar esta Política cuando cambie el producto o la ley. Los cambios informativos se notificarán de forma apropiada; no se presentarán artificialmente como consentimiento. Si un cambio exige una elección legal específica, se solicitará por separado.
