namespace com.logaligroup;

using {
    managed,
    sap.common.Languages
} from '@sap/cds/common';

/**
 * Reproduce la tabla SAP MARA de datos básicos de materiales.
 * Quedan fuera del alcance el cliente MANDT y los datos específicos de centro, almacén o clasificación ampliada.
 */
entity Materials : managed {
    key matnr        : String(18)     @description: 'MARA-MATNR: Número de material. Identifica el material de forma única.';
        mtart        : String(4)      @description: 'MARA-MTART: Tipo de material. Clasificación funcional mantenida en customizing.';
        mbrsh        : String(1)      @description: 'MARA-MBRSH: Sector industrial del material. Clasificación de un carácter mantenida en SAP.';
        matkl        : String(9)      @description: 'MARA-MATKL: Grupo de materiales. Sirve para agrupar materiales con criterios de negocio.';
        meins        : String(3)      @description: 'MARA-MEINS: Unidad de medida base del material. Debe corresponder a una unidad válida en SAP.';
        brgew        : Decimal(13, 3) @description: 'MARA-BRGEW: Peso bruto del material.';
        ntgew        : Decimal(13, 3) @description: 'MARA-NTGEW: Peso neto del material.';
        gewei        : String(3)      @description: 'MARA-GEWEI: Unidad de peso utilizada para los campos de peso.';
        stprs        : Decimal(11, 2) @description: 'MBEW-STPRS: Precio estándar unitario del material. El dato real pertenece a la tabla de valoración MBEW y aquí se aplana para simplificar la simulación de cotización.';
        waers        : String(5)      @description: 'MBEW-WAERS: Moneda del precio estándar. El origen real es la tabla de valoración MBEW.';
        lvorm        : Boolean        @description: 'MARA-LVORM: Indicador de borrado lógico. false significa activo y true significa marcado para borrar.';
        descriptions : Composition of many MaterialDescriptions
                           on descriptions.material = $self
                                      @description: 'MARA-MATNR/MAKT-MATNR: Textos del material en múltiples idiomas. La composición representa una relación uno a muchos con los registros de descripción.';
};

/**
 * Reproduce la tabla SAP MAKT de textos de materiales.
 * Quedan fuera del alcance el cliente MANDT y otros textos auxiliares no persistidos en el maestro.
 */
entity MaterialDescriptions {
    key material : Association to Materials @description: 'MAKT-MATNR: Material al que pertenece el texto.';
    key language : Association to Languages @description: 'MAKT-SPRAS: Idioma del texto descriptivo.';
        mktx     : String(40)               @description: 'MAKT-MAKTX: Descripción breve del material en ese idioma.';
};
