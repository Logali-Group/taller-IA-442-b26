# Prompt 3. Lógica del servicio en Node.js

## Prompt

```
Actúas como desarrollador senior de SAP Cloud Application Programming Model.

CONTEXTO
Tengo un servicio CAP en Node.js servido a la vez por OData, REST y MCP. Sus
acciones y funciones no ligadas son la única vía por la que un agente puede
escribir, porque el adaptador MCP solo sabe leer datos e invocar acciones no
ligadas. Las mismas operaciones siguen disponibles por OData para las
aplicaciones normales.

TAREA
Escribe el archivo <RUTA DEL ARCHIVO, por ejemplo srv/materials-service.js> que
implementa los handlers de este servicio:

<PEGA AQUÍ EL CONTENIDO COMPLETO DE TU ARCHIVO .cds DE SERVICIO>

REGLAS DE NEGOCIO
<LISTA DE REGLAS, una por línea. Por ejemplo:
 - la clave siempre se normaliza a mayúsculas y sin espacios
 - si no se indica clave en el alta, se asigna la siguiente libre de la serie
 - no se puede dar de alta una clave que ya exista
 - el peso neto nunca puede superar al peso bruto
 - el tipo y el sector solo admiten valores de una lista cerrada
 - la baja no borra el registro: activa una marca y lo deja para reorganizar>

CONVENCIONES OBLIGATORIAS

1. Idioma. Todos los identificadores en inglés: clase, constantes, variables,
   funciones auxiliares. Todos los comentarios en español, con su ortografía
   correcta y sus tildes. Los mensajes de error y de respuesta, en español,
   porque los lee una persona a través del agente.

2. Cabecera. El archivo abre con un bloque de comentarios // de cinco o seis
   líneas que explique qué contiene y por qué las escrituras se modelan como
   acciones no ligadas.

3. Estructura. Exporta una clase que extienda cds.ApplicationService con un
   método async init(). Dentro:
   - Desestructura las entidades desde this.entities en la primera línea.
   - Un this.before(['CREATE', 'UPDATE'], <Entidad>, ...) con las validaciones
     comunes del alta y la modificación por OData.
   - Un this.on por cada acción y función, en el mismo orden en que aparecen
     en el archivo .cds.
   - Cierra con return super.init().

4. Reglas compartidas. Las validaciones de negocio viven en una función
   auxiliar fuera de la clase, que llaman tanto el handler de OData como la
   acción. Devuelve el mensaje de error, o null si todo es correcto. Esto es lo
   que garantiza que un agente no pueda saltarse una regla usando MCP en lugar
   de OData.

5. Constantes. Las listas cerradas de valores válidos y los valores por
   omisión van como constantes en mayúsculas al principio del archivo, nunca
   incrustadas en el código.

6. Errores. Usa req.error con el código HTTP que corresponda: 400 dato
   inválido, 404 no encontrado, 409 conflicto por duplicado. El mensaje es una
   frase en español que explique el problema y, cuando ayude, cómo corregirlo.

7. Consultas. Usa CQL de CAP: SELECT, INSERT, UPDATE, DELETE. Para el alta de
   un registro con sus textos usa alta en profundidad, una sola instrucción con
   el array de la composición dentro. Para buscar sin distinguir mayúsculas usa
   upper() en los dos lados de la comparación, porque SAP HANA distingue
   mayúsculas aunque SQLite no.

8. Comentarios por sección. Antes de cada this.on, una línea de comentario //
   que diga en una frase qué resuelve ese handler.

9. Documentación de las auxiliares. Cada función fuera de la clase lleva un doc
   comment /** ... */ que explique qué calcula y, si procede, a qué mecanismo
   de SAP equivale.

10. Estilo. Sin punto y coma al final de las sentencias. Indentación de dos
    espacios. Comillas simples. Comillas invertidas solo para interpolar.

QUÉ NO QUIERO
- Comprobaciones de autorización: la seguridad se trata aparte.
- Dependencias externas más allá de @sap/cds.
- Explicaciones fuera del código. Devuelve solo el archivo.
```

---
