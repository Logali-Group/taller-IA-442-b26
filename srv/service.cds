using {com.logaligroup as db} from '../db/schema';
using {zsb1_flight_quote as flight} from './external/zsb1_flight_quote';

@cds.query.limit : {
    default : 20,
    max : 200
}
@odata
@rest
@mcp
service MaterialsService {

    entity Materials as projection on db.Materials;
    entity MaterialDescriptions as projection on db.MaterialDescriptions;
    @readonly
    entity FlightQuote as projection on flight.FlightQuote;

    type MaterialActionResult {
        matnr   : String(18);
        message  : String;
    }

    type MaterialTextActionResult {
        matnr   : String(18);
        language: String(14);
        message : String;
    }

    type MaterialSearchResult {
        matnr   : String(18);
        mtart   : String(4);
        mbrsh   : String(1);
        matkl   : String(9);
        meins   : String(3);
        brgew   : Decimal(13,3);
        ntgew   : Decimal(13,3);
        gewei   : String(3);
        lvorm   : Boolean;
        language: String(14);
        mktx    : String(40);
    }

    type MaterialPricingSimulationResult {
        matnr       : String(18);
        description : String(40);
        quantity    : Decimal(13,3);
        meins       : String(3);
        unitPrice   : Decimal(11,2);
        currency    : String(5);
        grossAmount : Decimal(15,2);
        discountPct : Decimal(5,2);
        netAmount   : Decimal(15,2);
        reason      : String(100);
    }

    type FlightQuoteResult {
        AirlineID    : String(3);
        ConnectionID : String(4);
        FlightDate   : Date;
        Passengers   : Integer;
        BasePrice    : Decimal(15,2);
        CurrencyCode : String(3);
        DiscountPct  : Decimal(5,2);
        NetPrice     : Decimal(15,2);
        Reason       : String(120);
    }

    /**
     * Registra un material nuevo y crea su primer texto en una sola llamada. Se modela como acción no ligada porque el adaptador MCP solo puede invocar escrituras así.
     * Los campos opcionales se dejan fuera cuando no se conocen; en particular, lvorm debería omitir-se para que el alta nazca como activo por defecto.
     */
    action registerMaterial(
        /** Número de material que se va a crear. */
        @mandatory matnr   : String(18),
        /** Tipo de material que clasifica el alta. */
        @mandatory mtart   : String(4),
        /** Sector industrial del material. */
        @mandatory mbrsh   : String(1),
        /** Grupo de materiales al que pertenece. */
        @mandatory matkl   : String(9),
        /** Unidad de medida base del material. */
        @mandatory meins   : String(3),
        /** Peso bruto del material. Si no se conoce, se deja vacío. */
        brgew              : Decimal(13,3),
        /** Peso neto del material. Si no se conoce, se deja vacío. */
        ntgew              : Decimal(13,3),
        /** Unidad del peso. Si no se conoce, se deja vacío. */
        gewei              : String(3),
        /** Idioma del primer texto que se va a crear. */
        @mandatory language: String(14),
        /** Texto descriptivo inicial del material. */
        @mandatory mktx    : String(40),
        /** Indicador de borrado lógico. Si se omite, el valor por defecto razonable es false. */
        lvorm              : Boolean
    ) returns MaterialActionResult;

    /**
     * Cambia o crea el texto de un material en un idioma concreto. Se modela como acción no ligada porque actualiza datos y el canal MCP no expone operaciones de modificación ligadas.
     * Así se conserva una única operación para el caso de uso de edición de textos sin obligar al agente a orquestar varias llamadas.
     */
    action updateMaterialText(
        /** Número de material cuyo texto se va a cambiar. */
        @mandatory matnr   : String(18),
        /** Idioma del texto objetivo. */
        @mandatory language: String(14),
        /** Nuevo texto descriptivo del material. */
        @mandatory mktx    : String(40)
    ) returns MaterialTextActionResult;

    /**
     * Marca un material para borrado lógico sin eliminarlo físicamente. Se modela como acción no ligada porque el adaptador MCP solo puede escribir a través de acciones y funciones del servicio.
     * De este modo se conserva el registro para trazabilidad y para posibles usos de negocio o auditoría posteriores.
     */
    action flagMaterialForDeletion(
        /** Número de material que se va a marcar. */
        @mandatory matnr   : String(18)
    ) returns MaterialActionResult;

    /**
     * Busca materiales por coincidencia parcial en sus textos. Se modela como función y no como acción porque solo lee y debe permanecer libre de efectos colaterales.
     * El agente puede usarla para recuperar candidatos antes de decidir una escritura posterior.
     */
    function findMaterialsByText(
        /** Palabras o fragmentos que deben aparecer en el texto. */
        @mandatory searchText: String(40)
    ) returns array of MaterialSearchResult;

    /**
     * Simula el precio de un pedido para un material y una cantidad. Se modela como función no ligada porque solo lee datos y calcula importes sin escribir en base de datos.
     * Esta forma la hace invocable por MCP mediante la herramienta call y mantiene la semántica correcta de consulta en OData.
     */
    function simulateOrderPricing(
        /** Número de material que se quiere cotizar. */
        @mandatory matnr   : String(18),
        /** Cantidad de unidades del pedido para el cálculo de importes y tramos. */
        @mandatory quantity: Decimal(13,3),
        /** Idioma de la descripción devuelta. Si se omite, se usa es. */
        language           : String(14)
    ) returns MaterialPricingSimulationResult;

    /**
     * Recupera una cotización de vuelo exacta por su clave compuesta del servicio remoto RAP.
     * Se modela como función no ligada porque solo consulta datos sin efectos de escritura.
     */
    function FlightQuote_get(
        /** Aerolínea (clave técnica). */
        @mandatory AirlineID   : String(3),
        /** Conexión de vuelo (clave técnica). */
        @mandatory ConnectionID: String(4),
        /** Fecha de vuelo. */
        @mandatory FlightDate  : Date,
        /** Pasajeros para la simulación. */
        @mandatory Passengers  : Integer
    ) returns FlightQuoteResult;

    /**
     * Busca cotizaciones de vuelo en el servicio remoto con filtros opcionales.
     * Se modela como función no ligada para exponer una consulta reusable por MCP.
     */
    function FlightQuote_query(
        /** Filtro por aerolínea. */
        AirlineID      : String(3),
        /** Filtro por conexión. */
        ConnectionID   : String(4),
        /** Filtro por fecha de vuelo. */
        FlightDate     : Date,
        /** Mínimo de pasajeros (incluyente). */
        minPassengers  : Integer,
        /** Máximo de pasajeros (incluyente). */
        maxPassengers  : Integer,
        /** Máximo de registros a devolver (1..200). */
        top            : Integer
    ) returns array of FlightQuoteResult;
};