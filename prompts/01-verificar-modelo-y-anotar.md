# Prompt 1. Verificar el modelo y colocar las descripciones

## Prompt

```
Actúas como desarrollador senior de SAP Cloud Application Programming Model y
como revisor de modelos de datos.

CONTEXTO
Este modelo alimenta un servicio CAP que se sirve también por MCP. El adaptador
MCP entrega al agente la anotación @description de cada elemento como contexto
del dominio. Sin ella, el agente recibe solo "Element matnr" y no sabe qué
representa el campo.

Es importante que sepas por qué se usa @description y no otra cosa, porque vas
a tener que defenderlo si el archivo trae comentarios:

- Un comentario // se queda en el archivo fuente. No llega a ningún sitio.
- Un doc comment /** */ encima del elemento tampoco sirve: la proyección del
  servicio DESCARTA el doc de los elementos. Se comprueba compilando el modelo
  a JSON: en la entidad de base de datos el doc está, y en la entidad del
  servicio vale null.
- Las anotaciones SÍ propagan a la proyección. Por eso la equivalencia con SAP
  va en @description, que además queda a la derecha del campo.
- En cambio, los doc comments /** */ SÍ funcionan sobre entidades, acciones,
  funciones y parámetros de acción. Ahí se mantienen.

TAREA
Sobre el archivo que pego más abajo, haz dos cosas en este orden.

PRIMERO, verifica la estructura y repórtala. Comprueba punto por punto:

1. El namespace es <NAMESPACE ESPERADO>.
2. El using importa exactamente lo que el modelo usa, ni más ni menos.
3. Están todas las entidades esperadas y ninguna de más:
   <LISTA DE ENTIDADES ESPERADAS con la tabla SAP que reproduce cada una>
4. Cada entidad tiene las claves correctas, en el orden correcto.
5. Cada campo existe, con el tipo y la longitud correctos:
   <LISTA DE CAMPOS ESPERADOS: nombre, tipo, longitud, valor por omisión si lo
    tiene, y campo de SAP al que equivale>
6. Los aspectos aplicados son los correctos (managed, cuid, temporal...).
7. Las asociaciones y composiciones apuntan a la entidad correcta y su
   condición on es coherente.
8. Cada elemento tiene su @description y empieza por la referencia al campo de
   SAP con el formato TABLA-CAMPO, por ejemplo MARA-MATNR.

Presenta el resultado en una tabla con cuatro columnas: elemento, esperado,
encontrado, veredicto. El veredicto es CORRECTO, DIFIERE o FALTA. Si algo
difiere, di en una frase qué consecuencia tiene, no solo que difiere. Por
ejemplo: una longitud menor que la de SAP trunca datos en silencio al
sincronizar.

SEGUNDO, devuelve el archivo corregido y anotado. Reglas:

1. Respeta la estructura que ya existe. Si un campo está bien, no lo toques.
   Solo corrige lo que la verificación marcó como DIFIERE o FALTA, y explica
   cada corrección en el informe.
2. Añade @description a todos los elementos que no la tengan. El texto empieza
   por TABLA-CAMPO seguido de dos puntos, y sigue con una explicación en
   español de una o dos frases que diga qué representa el campo. Cuando el
   campo admite una lista cerrada de valores, enuméralos con su significado:
   el agente los usará para no inventarse valores.
3. Escribe las descripciones en español correcto, con sus tildes. Se las va a
   leer un modelo de lenguaje y, a través de él, una persona.
4. Las entidades llevan doc comment /** */ encima explicando qué tabla de SAP
   reproducen y qué queda fuera del alcance. Ese sí sobrevive si se redeclara
   en el servicio.
5. Alinea los @description en columna, para que el archivo se lea como una
   tabla de equivalencias.
6. No añadas anotaciones de autorización ni de interfaz de usuario. Solo
   @description.
7. No cambies nombres de entidades ni de campos aunque te parezcan mejorables.
   Si detectas uno dudoso, dilo en el informe y deja que decida yo. Ejemplo
   real: un campo llamado mktx cuando en SAP es MAKTX.

```
---