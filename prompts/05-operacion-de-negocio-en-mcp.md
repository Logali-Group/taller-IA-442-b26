# Prompt 5. Operación de negocio disponible en MCP, de punta a punta

## Prompt

```
Actúas como desarrollador senior de SAP Cloud Application Programming Model.

NO ME HAGAS PREGUNTAS. Todo lo que necesitas está en este prompt. Si algo te
parece ambiguo, toma la decisión que mejor encaje con las convenciones que se
describen abajo, aplícala y anótala en una línea al final de tu respuesta.

CONTEXTO
Tengo un proyecto CAP en Node.js anotado con @mcp. El adaptador publica tres
herramientas por servicio: describe, query y call. La herramienta call solo
invoca operaciones NO LIGADAS. Consecuencia práctica: una operación de negocio
que el agente deba poder ejecutar tiene que declararse sin ligar a la entidad.
Si se declara ligada, compila, funciona por OData y el agente no la ve.

Para que la operación quede disponible de verdad hay que cerrar cuatro
eslabones, y fallar uno la deja a medias sin que nada avise:

  1. El modelo tiene los datos que la operación necesita.
  2. El servicio declara la operación como acción o función no ligada.
  3. El handler la implementa con sus reglas de negocio.
  4. Los datos de prueba permiten ejecutarla de verdad.

ARCHIVOS DEL PROYECTO
Lee del proyecto db/schema.cds, srv/materials-service.cds,
srv/materials-service.js, db/data/com.logaligroup-Materials.csv y
test/probar-mcp.js antes de escribir nada. Si no tienes acceso al sistema de
archivos, dímelo y te los pego.

Si la operación ya existe en el proyecto, NO la rehagas desde cero: verifica
que cumple todo lo que viene a continuación, corrige solo lo que falte o
difiera, y dime qué corregiste.

LA OPERACIÓN

Nombre: simulatePrice.

Qué hace, en términos de negocio: simula el precio de un pedido de un material.
Toma su precio estándar, lo multiplica por la cantidad pedida y le aplica un
descuento por volumen.

Naturaleza: solo consulta y calcula. No escribe, no modifica y no borra nada.
Dos llamadas seguidas con los mismos parámetros devuelven lo mismo y dejan la
base de datos igual. Por tanto se declara como function, no como action.

PARÁMETROS DE ENTRADA

  matnr    : String(40)      obligatorio.  Número de material a cotizar.
  quantity : Decimal(13, 3)  obligatorio.  Cantidad de unidades del pedido.
  language : String(14)      opcional.     Idioma de la descripción devuelta.
                                           Por omisión 'es'.

Los tipos no son orientativos: matnr es String(40) porque así está el campo en
la entidad, con la longitud de S/4HANA y no la de ECC. quantity es
Decimal(13, 3) porque hay materiales que se llevan en kilos y en litros, y un
Integer perdería los pedidos fraccionados.

CAMPOS DE LA RESPUESTA

  matnr       : String(40)      Número de material cotizado.
  description : String(40)      Texto breve del material en el idioma pedido.
  quantity    : Decimal(13, 3)  Cantidad cotizada, la que se recibió.
  meins       : String(3)       Unidad de medida base del material.
  unitPrice   : Decimal(11, 2)  Precio estándar unitario.
  currency    : String(5)       Moneda del precio.
  grossAmount : Decimal(15, 2)  Importe bruto: precio unitario por cantidad.
  discountPct : Decimal(5, 2)   Porcentaje de descuento aplicado.
  netAmount   : Decimal(15, 2)  Importe neto: bruto menos descuento.
  reason      : String(100)     Motivo del descuento, en texto legible.

Tres cosas de esa estructura son deliberadas y hay que respetarlas:

- Se devuelve el eco de la entrada (matnr, quantity, meins) aunque quien llama
  ya lo conozca, para que la respuesta se sostenga sola si acaba en un chat.
- Los importes son Decimal(15, 2) aunque el precio unitario sea Decimal(11, 2).
  Multiplicar un precio por una cantidad grande desborda la precisión del
  precio, y eso revienta tarde y mal.
- reason es texto legible, no un código. Lo lee una persona a través del
  agente. Es además la misma forma que devuelve el servicio RAP de cotización
  de vuelos con el que este servicio se combina, así que el agente compone las
  dos respuestas sin traducir nada.

CAMPOS QUE HACEN FALTA EN EL MODELO

La operación necesita un precio estándar y su moneda. Si la entidad Materials
no los tiene, añádelos con su anotación @description:

  stprs : Decimal(11, 2)  MBEW-STPRS: precio estándar del material.
  waers : String(5)       MBEW-WAERS: moneda del precio estándar. Por omisión EUR.

En la @description de stprs hay que decir explícitamente que en SAP ese campo
NO está en MARA sino en la tabla de valoración MBEW, y que aquí se aplana en el
maestro para simplificar el ejercicio. Esa frase es lo que separa un ejemplo
creíble de uno que no lo es delante de alguien que conoce SAP.

REGLAS, EN ESTE ORDEN DE COMPROBACIÓN

Normalización previa, antes de validar nada:
  - matnr se recorta de espacios y se pasa a mayúsculas.
  - language toma 'es' si no viene.

400, dato de entrada mal formado. Se comprueba antes de tocar la base de datos:
  - matnr vacío o solo espacios
      -> "Indica el número de material a cotizar"
  - quantity que no sea número finito, o menor o igual que cero
      -> "La cantidad debe ser un número mayor que cero"

404, el registro no existe:
  - matnr que no está en el maestro
      -> "El material <matnr> no existe en el maestro"

409, el material existe pero su estado no admite la operación:
  - lvorm = true
      -> "El material <matnr> está marcado para borrado y no admite cotización"
  - stprs nulo
      -> "El material <matnr> no tiene precio estándar, así que no se puede cotizar"

El orden importa. Primero lo que se valida sin consultar nada, después la
existencia y al final el estado: así una cantidad en negativo no gasta una
consulta y el error apunta al parámetro que quien llama controla.

La diferencia entre 404 y 409 tampoco es cosmética. El 404 dice "eso no
existe"; el 409 dice "existe, pero su estado actual no permite lo que pides".
Un material marcado para borrado está ahí y sale en las listas: lo que no
admite es entrar en un pedido nuevo. Devolver 404 haría creer al agente que no
existe y probablemente intentaría darlo de alta otra vez.

CASO QUE NO ES ERROR
Si el material no tiene descripción en el idioma pedido, description se
devuelve nula y la cotización se calcula igualmente. Falta un texto, no un dato
de negocio.

CÁLCULOS

  1. unitPrice = stprs del material.
  2. grossAmount = unitPrice * quantity, redondeado a dos decimales.
  3. discountPct: se recorre la escala de mayor a menor y gana el primer tramo
     que la cantidad alcanza.
       >= 1000 unidades -> 12 %  "Descuento por volumen (>= 1000 unidades)"
       >=  500 unidades ->  8 %  "Descuento por volumen (>= 500 unidades)"
       >=  100 unidades ->  4 %  "Descuento por volumen (>= 100 unidades)"
       resto            ->  0 %  "Sin descuento: la cantidad no alcanza el primer tramo (100 unidades)"
  4. netAmount = grossAmount * (1 - discountPct / 100), redondeado a dos decimales.
  5. reason = el texto del tramo que se aplicó.

La escala va en una constante en mayúsculas al principio del archivo, como
array de objetos con el umbral, el porcentaje y el motivo. Nunca incrustada en
el código con condicionales encadenados.

QUÉ TIENES QUE PRODUCIR

  1. Los campos que falten en el modelo, con su @description.
  2. La función no ligada en el servicio, con doc comment /** */ encima
     explicando qué hace y por qué es función y no acción, y otro doc comment
     sobre cada parámetro. En las operaciones los doc comments sí llegan al
     agente, a diferencia de los elementos de la entidad, donde hay que usar
     @description.
  3. El handler, con un this.on por la operación y las reglas en constantes o
     funciones auxiliares. Errores con req.error y el código que corresponda.
  4. Los datos de prueba: si añadiste campos, actualiza el CSV de db/data para
     que todos los materiales tengan precio y moneda. Deja al menos un material
     marcado para borrado, para poder demostrar el camino de error.
  5. Dos comprobaciones nuevas en test/probar-mcp.js: una con datos válidos y
     otra que dispare la regla del material marcado para borrado. Sigue el
     estilo de las que ya hay: comentario numerado que diga qué demuestra,
     cabecera == nombre == con el estado, y salida recortada.

CONVENCIONES
- Identificadores en inglés, comentarios y textos en español con sus tildes.
- Sin punto y coma al final de las sentencias, dos espacios de indentación,
  comillas simples.
- Los mensajes de error son frases completas en español que explican el
  problema. Los lee una persona a través del agente, así que nada de códigos
  ni de "invalid input".
- Redondea los importes antes de devolverlos.

QUÉ NO QUIERO
- Operaciones ligadas a entidad: el adaptador MCP no las invoca.
- Dependencias nuevas más allá de @sap/cds.
- Anotaciones de autorización.
- Explicaciones fuera del código. Devuelve los archivos modificados completos,
  no fragmentos sueltos.
```

---

## Comprobación de la salida

Prompt sugerido para simular precio (con respuesta esperada)

Simula el precio del material MAT-1001 con cantidad 550 y idioma es usando la función simulateOrderPricing del servicio MCP. Devuélveme el resultado con matnr, description, quantity, meins, unitPrice, currency, grossAmount, discountPct, netAmount y reason.

Respuesta esperada con los datos actuales:

matnr: MAT-1001
description: Bomba hidráulica de engranajes
quantity: 550
meins: ST
unitPrice: 145.9
currency: EUR
grossAmount: 80245
discountPct: 8
netAmount: 73825.4
reason: Se aplica descuento por volumen del 8% para cantidades desde 500 unidades.

## Materiales disponibles

MAT-1001, tipo FERT, unidad ST, precio 145.90 EUR, lvorm=false
MAT-1002, tipo HAWA, unidad ST, precio 18.40 EUR, lvorm=false
MAT-1003, tipo ROH, unidad KG, precio 9.75 EUR, lvorm=false
MAT-1004, tipo HALB, unidad ST, precio 67.30 EUR, lvorm=false
MAT-1005, tipo VERP, unidad ST, precio 2.10 EUR, lvorm=false
MAT-1006, tipo DIEN, unidad ST, precio null, lvorm=false
MAT-1007, tipo ROH, unidad L, precio 4.85 EUR, lvorm=false
MAT-1008, tipo FERT, unidad ST, precio 220.00 EUR, lvorm=true