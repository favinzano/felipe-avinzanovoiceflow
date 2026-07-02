# Diseño del cambio de marca a felipe avinzano VoiceFlow

Fecha: 2026-07-01

## Objetivo

Cambiar integralmente la identidad de la aplicación a `felipe avinzano VoiceFlow`, aplicar el tratamiento visual aprobado en todas las superficies de producto y distribución, y migrar los datos existentes sin pérdida ni reinicio innecesario.

## Identidad aprobada

- Nombre visible: `felipe avinzano VoiceFlow`.
- Composición: `felipe avinzano Voice` conserva Geist y su tratamiento actual; solo `Flow` usa DM Serif Display, peso nativo 400, y copper `#B66D45`.
- Slug técnico: `felipe-avinzanovoiceflow`.
- App ID: `com.felipeavinzano.voiceflow`.
- Repositorio: `favinzano/felipe-avinzanovoiceflow`.
- Alcance: interfaz, overlay, bandeja, diálogos, diagnósticos, instalador, ejecutable, accesos directos, desinstalador, helper, scripts, documentación, nombres de archivos e identificadores internos.

## Fuente canónica de marca

Se añadirá una configuración de marca legible por Node y por los scripts del proyecto. Contendrá el nombre, sus segmentos visuales, slug, App ID, repositorio, color copper y las identidades heredadas necesarias para migración.

Electron, los preload, la interfaz, el overlay y los scripts de release consumirán esta configuración. Los valores que electron-builder exige dentro de `package.json` permanecerán duplicados allí, pero una prueba automática comprobará que coincidan con la fuente canónica.

Los documentos HTML dejarán de repetir manualmente el nombre cuando sea viable. Los preload expondrán únicamente los campos de marca necesarios a los renderers, manteniendo `contextIsolation` y sin habilitar acceso general a Node.

## Tratamiento visual

Los wordmarks separarán semánticamente `Flow` del resto del nombre. La clase del sufijo usará:

- `font-family: "DM Serif Display", serif`;
- `font-weight: 400`;
- `color: #B66D45`, preferentemente mediante el token `--copper` existente.

El mismo tratamiento aparecerá en la barra de título, navegación lateral, overlay y demostraciones internas. Los lugares que solo admiten texto plano —por ejemplo, títulos nativos, bandeja, diálogos, ejecutable y acceso directo— usarán el nombre completo sin formato parcial.

DM Serif Display debe incluirse explícitamente entre los recursos empaquetados y verificarse dentro del build de producción.

## Renombrado técnico y distribución

Se actualizarán el nombre del paquete, `productName`, App ID, metadatos de autor y descripción, nombres de instalador, ejecutable, desinstalador y acceso directo. El componente auxiliar se renombrará de forma coherente con la nueva identidad y se actualizarán todas las rutas que lo compilan, empaquetan, comprimen, firman y verifican.

Los scripts de release, firma, pruebas del instalador y validación de paquetes calcularán los nombres desde la configuración o los validarán contra ella. Los enlaces de soporte y actualización apuntarán a `favinzano/felipe-avinzanovoiceflow`.

## Migración de datos

La nueva ruta de producción será `%APPDATA%\felipe avinzano VoiceFlow`; desarrollo usará una variante claramente marcada como Development. Antes de cargar estado, preferencias o modelos, el arranque buscará las rutas heredadas conocidas:

- `%APPDATA%\NextStepAI Voice`;
- `%APPDATA%\felipe avinzano Voice`;
- las variantes de desarrollo de ambas identidades.

La migración copiará el estado persistido, preferencias, diccionario, historial, selección de micrófono y caché de modelos. Será idempotente y conservará las carpetas antiguas para rollback. Si existen datos en el destino, esos datos prevalecerán y solo se copiarán elementos ausentes de forma segura.

La operación usará un área temporal o escrituras atómicas, validará el JSON antes de promoverlo y solo creará la marca de finalización cuando todo lo requerido termine correctamente. Una ejecución interrumpida se podrá repetir.

Si la migración falla, la aplicación no mostrará silenciosamente un perfil vacío. Informará el problema y usará la ruta heredada seleccionada durante esa sesión, sin eliminarla ni marcar la migración como completada. El siguiente arranque volverá a intentarlo.

El inicio con Windows se reconfigurará con el nuevo ejecutable. Solo se retirarán entradas heredadas que puedan identificarse con certeza; no se modificarán entradas ambiguas.

## Documentación histórica

La documentación activa adoptará la marca nueva. Las notas de releases ya publicados conservarán nombres antiguos de productos, instaladores o repositorios cuando sean hechos históricos verificables. En esos documentos se añadirá contexto que indique que corresponden a la identidad anterior.

Una auditoría automatizada mantendrá una lista explícita de excepciones históricas. Cualquier referencia heredada fuera de esa lista hará fallar la verificación.

## Manejo de errores

- La migración nunca elimina los datos de origen.
- Los conflictos favorecen datos ya existentes en el destino.
- Un JSON heredado inválido no reemplaza un estado válido; se intentará la copia de respaldo existente y, si tampoco es válida, se informará el error.
- Los fallos de copia de modelos no dejan un directorio de destino presentado como completo.
- Los diagnósticos incluirán resultado y origen de la migración, pero nunca transcripciones ni contenido del diccionario.

## Verificación

Se añadirán pruebas para:

- consistencia entre la configuración canónica y `package.json`;
- selección de la ruta heredada correcta;
- migración inicial, repetida, parcial y con conflictos;
- recuperación frente a estado principal dañado y uso de backup;
- conservación de modelos y comportamiento ante una copia interrumpida;
- ausencia de referencias heredadas fuera de la lista histórica;
- nombres esperados del ejecutable, instalador, helper, desinstalador y acceso directo;
- inclusión de DM Serif Display en el paquete;
- aplicación de DM Serif Display 400 y `#B66D45` al segmento `Flow`.

La aceptación final requiere que pase la suite completa, la verificación de modelos empaquetados aplicable y un build de producción. También se inspeccionarán visualmente el wordmark principal y el overlay sobre fondos claro y oscuro.

## Límites

- No se rediseñará el isotipo ni la estructura general de la interfaz.
- No se eliminarán datos o carpetas heredadas.
- No se reescribirá la historia de artefactos ya publicados.
- No se cambiarán funciones de dictado, audio o transcripción salvo las rutas necesarias para conservar sus datos.
