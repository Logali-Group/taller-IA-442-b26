using {com.logaligroup as db} from '../db/schema';

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
};