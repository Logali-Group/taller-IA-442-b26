# Prompt 4. Script de pruebas del endpoint MCP

## Prompt

```
Actúas como desarrollador senior de Node.js con experiencia en el Model Context
Protocol.

CONTEXTO
Tengo un servicio CAP anotado con @mcp que sirve un endpoint MCP en
<RUTA DEL ENDPOINT, por ejemplo /mcp/materials> del servidor local, puerto
4004.

MCP no se prueba con un curl suelto. Es JSON-RPC 2.0 sobre HTTP y el protocolo
exige un saludo inicial antes de poder listar o invocar nada: primero
initialize, después la notificación notifications/initialized, y solo entonces
tools/list y tools/call. Además, las respuestas pueden llegar como evento SSE,
con el JSON dentro de una línea que empieza por "data:".

TAREA
Crea la carpeta test/ y dentro el archivo probar-mcp.js, que ejecute en orden
las comprobaciones de la lista de abajo e imprima el resultado de cada una.

COMPROBACIONES, en este orden

1. initialize. Imprime el código de estado y el nombre del servidor que
   devuelve, para confirmar que el adaptador respondió y que es el servicio
   esperado.
2. tools/list. Imprime el nombre de cada herramienta publicada y, de la
   herramienta que invoca acciones, la lista de acciones disponibles que trae
   en su esquema de entrada. Esa lista es la prueba de qué puede hacer el
   agente.
3. describe sobre <ENTIDAD PRINCIPAL>. Imprime la respuesta recortada. Sirve
   para ver qué contexto del modelo recibe el agente, incluidas las
   descripciones de cada campo.
4. query con una sentencia CQL que siga una asociación o composición, para
   comprobar que el agente puede navegar el modelo:
   <SENTENCIA CQL DE EJEMPLO>
5. Llamada a la acción de alta con parámetros válidos:
   <NOMBRE DE LA ACCIÓN Y SUS PARÁMETROS>
6. La misma acción con datos que incumplen una regla de negocio, para
   comprobar que la validación también se aplica por esta vía:
   <PARÁMETROS QUE DEBEN SER RECHAZADOS Y MENSAJE ESPERADO>
7. Llamada a la función de consulta:
   <NOMBRE DE LA FUNCIÓN Y SU PARÁMETRO>

CONVENCIONES OBLIGATORIAS

1. Idioma. Identificadores en inglés, comentarios en español con sus tildes.

2. Sin dependencias. Solo el módulo http de Node. Nada de axios, node-fetch ni
   librerías de MCP: el script tiene que poder ejecutarse en un proyecto recién
   clonado sin instalar nada.

3. Cabecera. El archivo abre con un bloque de comentarios // que explique por
   qué MCP no se prueba con un curl suelto y qué hace el script.

4. Tres funciones auxiliares, antes del cuerpo:
   - call(body): envía una petición JSON-RPC y devuelve { status, body }.
     Cabeceras obligatorias: Content-Type application/json, Accept con
     application/json y text/event-stream, y Content-Length calculado con
     Buffer.byteLength.
   - parse(raw): extrae el JSON de la respuesta, contemplando que venga como
     evento SSE en una línea "data:". Si no se puede interpretar, devuelve el
     texto en bruto en lugar de lanzar.
   - textOf(response): saca el texto del primer bloque de content de la
     respuesta de una herramienta, con un valor alternativo si no está.

5. Resistencia. El script NUNCA debe lanzar una excepción ni quedarse colgado.
   Pon un timeout de 20 segundos por petición y trata los eventos timeout y
   error resolviendo la promesa con un estado descriptivo, TIMEOUT o ERROR más
   el código. Un servidor caído tiene que producir una salida legible, no una
   traza de pila.

6. Salida. Cada comprobación imprime una cabecera con el formato
   == nombre de la comprobación == seguida del estado, y debajo el resultado
   recortado a unos cientos de caracteres para que quepa en pantalla. El
   recorte es a propósito: el script sirve para ver de un vistazo si algo se
   rompió, no para volcar la respuesta entera.

7. Numeración. Cada comprobación lleva encima un comentario // numerado que
   diga qué demuestra, no qué hace. "Que ve el agente al describir el modelo"
   en lugar de "llama a describe".

8. Identificadores JSON-RPC. Usa un id distinto y creciente en cada petición.
   La notificación notifications/initialized no lleva id, porque es una
   notificación y no espera respuesta.

9. Estilo. Sin punto y coma al final de las sentencias. Indentación de dos
   espacios. Comillas simples. Envuelve el cuerpo en una función asíncrona
   autoejecutada.

QUÉ NO QUIERO
- Un marco de pruebas. Nada de jest, mocha ni vitest: esto se ejecuta con
  node test/probar-mcp.js y punto.
- Aserciones que corten la ejecución al primer fallo. Quiero ver el resultado
  de las siete comprobaciones aunque una falle, porque el diagnóstico suele
  estar en la combinación.
- Explicaciones fuera del código. Devuelve solo el archivo.
```
---