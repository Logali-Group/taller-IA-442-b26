# Prompt 2. Acciones y funciones del servicio en CDS

## Prompt

```
Actúas como desarrollador senior de SAP Cloud Application Programming Model.

CONTEXTO
Estoy construyendo un servicio CAP en Node.js que se sirve por OData, REST y
MCP a la vez. El adaptador MCP (@cap-js/mcp) expone hoy tres herramientas:
describe, query y call. La herramienta call solo invoca acciones y funciones NO
LIGADAS. No existen herramientas de creación, modificación ni borrado. Por eso
toda operación de escritura que deba poder llegar desde un agente tiene que
modelarse como acción no ligada del servicio.

TAREA
Escribe el bloque de acciones y funciones no ligadas del servicio
<NOMBRE DEL SERVICIO>, que trabaja sobre la entidad <ENTIDAD PRINCIPAL> y su
composición de textos <ENTIDAD DE TEXTOS>.

Las operaciones que necesito son:
<LISTA DE OPERACIONES, una por línea, con lo que hace cada una. Por ejemplo:
 - dar de alta un registro nuevo junto a su primer texto, en una sola operación
 - cambiar el texto en un idioma concreto, creándolo si no existía
 - marcar un registro para borrado sin eliminarlo
 - buscar registros cuyo texto contenga unas palabras>

CONVENCIONES OBLIGATORIAS

1. Idioma. Todos los identificadores en inglés: nombres de acciones,
   funciones, parámetros y campos de retorno. Todos los comentarios y todos los
   textos de descripción en español, con su ortografía correcta y sus tildes.

2. Comentarios. Cada acción y cada función lleva encima un doc comment
   /** ... */ de dos o tres frases que explique qué hace y por qué se modela
   así. Cada parámetro lleva su propio doc comment /** ... */ en la línea
   inmediatamente anterior. Esto no es documentación decorativa: el adaptador
   MCP lee esos comentarios y se los entrega al modelo de lenguaje como
   contexto. De su calidad depende que el agente sepa qué está invocando.

3. Verbos. Las acciones llevan verbo en infinitivo inglés que describa el
   efecto: register, update, flag, cancel. Las funciones llevan verbo de
   consulta: find, get, calculate. Nunca uses una acción para algo que solo
   lee, ni una función para algo que escribe.

4. Parámetros obligatorios. Los que no pueden faltar se marcan con @mandatory.
   Los que tienen un valor por omisión razonable se dejan opcionales y el
   comentario indica cuál es ese valor.

5. Tipos. Usa exactamente los mismos tipos y longitudes que los campos
   equivalentes de la entidad, para que no haya truncamientos silenciosos.

6. Retorno. Toda acción devuelve una estructura con la clave del registro
   afectado y un campo message de tipo String con una frase en español que
   explique qué ocurrió. El agente enseña ese mensaje al usuario tal cual, así
   que tiene que ser una frase completa y comprensible, no un código.
   Las funciones devuelven array of con la estructura de la fila.

7. Formato. Alinea los dos puntos de los parámetros en columna. Indenta con
   cuatro espacios dentro del servicio.

QUÉ NO QUIERO
- Acciones ligadas a entidad: el adaptador MCP no las invoca.
- Anotaciones de autorización: la seguridad se trata aparte.
- Explicaciones fuera del código. Devuelve solo el bloque CDS.
```

---
