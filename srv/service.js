// Implementación del servicio de materiales para OData, REST y MCP.
// Las escrituras se modelan como acciones no ligadas porque el adaptador MCP
// solo invoca acciones y funciones no ligadas, no operaciones CRUD directas.
// Los handlers reutilizan las mismas validaciones para que OData y MCP apliquen
// exactamente las mismas reglas de negocio.
// Las consultas y escrituras usan CQL de CAP para mantener la lógica portable.

import cds from '@sap/cds'
import 'dotenv/config'

const { SELECT, INSERT, UPDATE } = cds.ql

const FIELD_LENGTHS = Object.freeze({
  matnr: 18,
  mtart: 4,
  mbrsh: 1,
  matkl: 9,
  meins: 3,
  language: 14,
  mktx: 40,
  gewei: 3,
  waers: 5
})

const DEFAULT_LVORM = false
const DEFAULT_USER = 'anonymous'
const DEFAULT_LANGUAGE = 'es'

const DISCOUNT_SCALE = Object.freeze([
  {
    minQty: 1000,
    pct: 12,
    reason: 'Se aplica descuento por volumen del 12% para cantidades desde 1000 unidades.'
  },
  {
    minQty: 500,
    pct: 8,
    reason: 'Se aplica descuento por volumen del 8% para cantidades desde 500 unidades.'
  },
  {
    minQty: 100,
    pct: 4,
    reason: 'Se aplica descuento por volumen del 4% para cantidades desde 100 unidades.'
  },
  {
    minQty: 0,
    pct: 0,
    reason: 'No aplica descuento por volumen para cantidades inferiores a 100 unidades.'
  }
])

/**
 * Valida los datos comunes del maestro de materiales para alta y modificación.
 * Equivale a la comprobación previa que debe aplicar tanto OData como las acciones.
 */
function validateMaterialData (data, isCreate = false) {
  const {
    matnr,
    mtart,
    mbrsh,
    matkl,
    meins,
    brgew,
    ntgew,
    gewei,
    stprs,
    waers,
    lvorm
  } = data || {}

  if (!matnr) return 'Falta la clave matnr del material.'
  if (String(matnr).length > FIELD_LENGTHS.matnr) {
    return 'La clave matnr no puede superar 18 caracteres.'
  }

  if (isCreate && !mtart) return 'Falta el tipo de material mtart.'
  if (isCreate && !mbrsh) return 'Falta el sector industrial mbrsh.'
  if (isCreate && !matkl) return 'Falta el grupo de materiales matkl.'
  if (isCreate && !meins) return 'Falta la unidad de medida base meins.'

  if (mtart != null && String(mtart).length > FIELD_LENGTHS.mtart) {
    return 'El tipo de material mtart no puede superar 4 caracteres.'
  }
  if (mbrsh != null && String(mbrsh).length > FIELD_LENGTHS.mbrsh) {
    return 'El sector industrial mbrsh no puede superar 1 carácter.'
  }
  if (matkl != null && String(matkl).length > FIELD_LENGTHS.matkl) {
    return 'El grupo de materiales matkl no puede superar 9 caracteres.'
  }
  if (meins != null && String(meins).length > FIELD_LENGTHS.meins) {
    return 'La unidad de medida base meins no puede superar 3 caracteres.'
  }
  if (gewei != null && String(gewei).length > FIELD_LENGTHS.gewei) {
    return 'La unidad de peso gewei no puede superar 3 caracteres.'
  }
  if (waers != null && String(waers).length > FIELD_LENGTHS.waers) {
    return 'La moneda waers no puede superar 5 caracteres.'
  }

  if (brgew != null && Number.isNaN(Number(brgew))) {
    return 'El peso bruto brgew debe ser un número válido.'
  }
  if (ntgew != null && Number.isNaN(Number(ntgew))) {
    return 'El peso neto ntgew debe ser un número válido.'
  }
  if (stprs != null && Number.isNaN(Number(stprs))) {
    return 'El precio estándar stprs debe ser un número válido.'
  }
  if (brgew != null && ntgew != null && Number(ntgew) > Number(brgew)) {
    return 'El peso neto no puede ser mayor que el peso bruto.'
  }

  if (lvorm !== undefined && typeof lvorm !== 'boolean') {
    return 'El indicador lvorm debe ser booleano.'
  }

  return null
}

/**
 * Valida los datos del texto de material antes de escribirlos.
 * Equivale al control que evita truncamientos y campos vacíos en la composición de textos.
 */
function validateMaterialTextData (data) {
  const { language, mktx } = data || {}

  if (!language) return 'Falta el idioma language del texto.'
  if (!mktx) return 'Falta el texto mktx del material.'

  if (String(language).length > FIELD_LENGTHS.language) {
    return 'El idioma language no puede superar 14 caracteres.'
  }
  if (String(mktx).length > FIELD_LENGTHS.mktx) {
    return 'El texto mktx no puede superar 40 caracteres.'
  }

  return null
}

/**
 * Valida el texto de búsqueda antes de ejecutar la función de consulta.
 * Evita búsquedas vacías que no aportarían resultado y solo cargarían el servicio.
 */
function validateSearchText (searchText) {
  if (!searchText) return 'Debe informarse un texto de búsqueda.'
  if (String(searchText).length > FIELD_LENGTHS.mktx) {
    return 'El texto de búsqueda no puede superar 40 caracteres.'
  }

  return null
}

/**
 * Normaliza el identificador de material para aplicar reglas homogéneas de búsqueda.
 * Equivale a tratar la clave técnica sin variaciones de espacios o mayúsculas.
 */
function normalizeMatnr (value) {
  return String(value ?? '').trim().toUpperCase()
}

/**
 * Normaliza el idioma de entrada y aplica el valor por omisión cuando falta.
 * Equivale a usar español como idioma de fallback para la descripción de salida.
 */
function normalizeLanguage (value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized || DEFAULT_LANGUAGE
}

/**
 * Redondea un importe a dos decimales para salida estable y legible.
 * Equivale al ajuste de escala monetaria antes de devolver resultados al agente.
 */
function roundAmount (value) {
  return Number((Number(value) || 0).toFixed(2))
}

/**
 * Redondea cantidades a tres decimales respetando la escala del pedido.
 * Evita discrepancias de presentación frente a la precisión de entrada.
 */
function roundQuantity (value) {
  return Number((Number(value) || 0).toFixed(3))
}

/**
 * Devuelve el tramo de descuento por volumen según la cantidad solicitada.
 * Equivale a la tabla de escalas comercial aplicada de mayor a menor umbral.
 */
function resolveDiscountTier (quantity) {
  return DISCOUNT_SCALE.find(tier => quantity >= tier.minQty) || DISCOUNT_SCALE[DISCOUNT_SCALE.length - 1]
}

/**
 * Valida parámetros de simulación de precio antes de consultar datos maestros.
 * Asegura errores 400 tempranos cuando faltan o vienen mal formados.
 */
function validateSimulationInput (matnr, quantity, language) {
  if (!matnr) {
    return 'Indica el número de material a cotizar.'
  }

  if (String(matnr).length > FIELD_LENGTHS.matnr) {
    return 'El número de material no puede superar 18 caracteres.'
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 'La cantidad debe ser un número mayor que cero.'
  }

  if (language && String(language).length > FIELD_LENGTHS.language) {
    return 'El idioma no puede superar 14 caracteres.'
  }

  return null
}

/**
 * Valida las claves de entrada para consultar una cotización remota puntual.
 */
function validateFlightQuoteGetInput ({ AirlineID, ConnectionID, FlightDate, Passengers }) {
  if (!AirlineID) return 'AirlineID es obligatorio.'
  if (!ConnectionID) return 'ConnectionID es obligatorio.'
  if (!FlightDate) return 'FlightDate es obligatorio.'
  if (!Number.isInteger(Passengers) || Passengers <= 0) {
    return 'Passengers debe ser un entero mayor que cero.'
  }
  if (String(AirlineID).length > 3) return 'AirlineID no puede superar 3 caracteres.'
  if (String(ConnectionID).length > 4) return 'ConnectionID no puede superar 4 caracteres.'

  return null
}

/**
 * Valida filtros opcionales para consulta de cotizaciones remotas.
 */
function validateFlightQuoteQueryInput ({ AirlineID, ConnectionID, minPassengers, maxPassengers, top }) {
  if (AirlineID != null && String(AirlineID).length > 3) {
    return 'AirlineID no puede superar 3 caracteres.'
  }
  if (ConnectionID != null && String(ConnectionID).length > 4) {
    return 'ConnectionID no puede superar 4 caracteres.'
  }
  if (minPassengers != null && (!Number.isInteger(minPassengers) || minPassengers <= 0)) {
    return 'minPassengers debe ser un entero mayor que cero.'
  }
  if (maxPassengers != null && (!Number.isInteger(maxPassengers) || maxPassengers <= 0)) {
    return 'maxPassengers debe ser un entero mayor que cero.'
  }
  if (minPassengers != null && maxPassengers != null && minPassengers > maxPassengers) {
    return 'minPassengers no puede ser mayor que maxPassengers.'
  }
  if (top != null && (!Number.isInteger(top) || top < 1 || top > 200)) {
    return 'top debe ser un entero entre 1 y 200.'
  }

  return null
}

/**
 * Comprueba si existe un material y devuelve un mensaje en caso de conflicto o ausencia.
 * Equivale a la validación de unicidad o de existencia que necesitan tanto OData como las acciones.
 */
async function validateMaterialPresence (tx, Materials, matnr, { mustExist = false, mustBeNew = false } = {}) {
  const existing = await tx.run(
    SELECT.one.from(Materials).columns('matnr').where({ matnr })
  )

  if (mustBeNew && existing) {
    return 'Ya existe un material con esa clave. Usa otra clave o actualiza el existente.'
  }

  if (mustExist && !existing) {
    return 'No existe ningún material con esa clave.'
  }

  return null
}

/**
 * Comprueba si existe un idioma en la lista de códigos SAP.
 * Evita grabar textos con idiomas que no pertenezcan al catálogo estándar.
 */
async function validateLanguagePresence (tx, language) {
  const existing = await tx.run(
    SELECT.one.from('sap.common.Languages').columns('code').where({ code: language })
  )

  if (!existing) {
    return 'El idioma indicado no existe en el catálogo de SAP.'
  }

  return null
}

export default class MaterialsService extends cds.ApplicationService {

  async init () {
    const { Materials, MaterialDescriptions, FlightQuote } = this.entities
    const fligth = cds.connect.to('zsb1_flight_quote')

    this.on('READ', FlightQuote, async req => {

      return (await fligth).tx(req).send({
        query: req.query
      })

    });

    // Recupera una cotización puntual del servicio remoto usando la clave completa.
    this.on('FlightQuote_get', async req => {
      const input = {
        AirlineID: String(req.data.AirlineID ?? '').trim().toUpperCase(),
        ConnectionID: String(req.data.ConnectionID ?? '').trim(),
        FlightDate: req.data.FlightDate,
        Passengers: Number(req.data.Passengers)
      }

      const message = validateFlightQuoteGetInput(input)
      if (message) return req.error(400, message)

      const remoteTx = (await fligth).tx(req)
      const row = await remoteTx.send({
        query: SELECT.one.from('FlightQuote').where({
          AirlineID: input.AirlineID,
          ConnectionID: input.ConnectionID,
          FlightDate: input.FlightDate,
          Passengers: input.Passengers
        })
      })

      if (!row) {
        return req.error(
          404,
          `No existe cotización para AirlineID=${input.AirlineID}, ConnectionID=${input.ConnectionID}, FlightDate=${input.FlightDate} y Passengers=${input.Passengers}.`
        )
      }

      return row
    })

    // Consulta cotizaciones remotas con filtros opcionales y límite configurable.
    this.on('FlightQuote_query', async req => {
      const input = {
        AirlineID: req.data.AirlineID != null ? String(req.data.AirlineID).trim().toUpperCase() : null,
        ConnectionID: req.data.ConnectionID != null ? String(req.data.ConnectionID).trim() : null,
        FlightDate: req.data.FlightDate ?? null,
        minPassengers: req.data.minPassengers != null ? Number(req.data.minPassengers) : null,
        maxPassengers: req.data.maxPassengers != null ? Number(req.data.maxPassengers) : null,
        top: req.data.top != null ? Number(req.data.top) : null
      }

      const message = validateFlightQuoteQueryInput(input)
      if (message) return req.error(400, message)

      const query = SELECT.from('FlightQuote')

      if (input.AirlineID) query.where({ AirlineID: input.AirlineID })
      if (input.ConnectionID) query.where({ ConnectionID: input.ConnectionID })
      if (input.FlightDate) query.where({ FlightDate: input.FlightDate })
      if (input.minPassengers != null) query.where`Passengers >= ${input.minPassengers}`
      if (input.maxPassengers != null) query.where`Passengers <= ${input.maxPassengers}`
      if (input.top != null) query.limit(input.top)

      const remoteTx = (await fligth).tx(req)
      return remoteTx.send({
        query
      })
    })

    this.before(['CREATE', 'UPDATE'], Materials, async req => {
      const materialData = {
        ...req.data,
        matnr: req.data.matnr ?? req.params?.[0]?.matnr
      }
      const message = validateMaterialData(materialData, req.event === 'CREATE')
      if (message) return req.error(400, message)

      const tx = cds.tx(req)
      const presenceMessage = await validateMaterialPresence(
        tx,
        Materials,
        materialData.matnr,
        {
          mustExist: req.event === 'UPDATE',
          mustBeNew: req.event === 'CREATE'
        }
      )

      if (presenceMessage) {
        return req.error(req.event === 'CREATE' ? 409 : 404, presenceMessage)
      }

      if (req.event === 'CREATE' && materialData.lvorm === undefined) {
        req.data.lvorm = DEFAULT_LVORM
      }
    })

    // Registra un material nuevo junto con su primer texto.
    this.on('registerMaterial', async req => {
      const tx = cds.tx(req)
      const materialData = {
        matnr: req.data.matnr,
        mtart: req.data.mtart,
        mbrsh: req.data.mbrsh,
        matkl: req.data.matkl,
        meins: req.data.meins,
        brgew: req.data.brgew,
        ntgew: req.data.ntgew,
        gewei: req.data.gewei,
        lvorm: req.data.lvorm ?? DEFAULT_LVORM
      }
      const textData = {
        language: req.data.language,
        mktx: req.data.mktx
      }

      let message = validateMaterialData(materialData, true)
      if (message) return req.error(400, message)

      message = validateMaterialTextData(textData)
      if (message) return req.error(400, message)

      message = await validateMaterialPresence(tx, Materials, materialData.matnr, { mustBeNew: true })
      if (message) return req.error(409, message)

      message = await validateLanguagePresence(tx, textData.language)
      if (message) return req.error(400, message)

      const now = new Date()
      const actor = req.user && req.user.id ? req.user.id : DEFAULT_USER

      await tx.run(
        INSERT.into(Materials).entries({
          ...materialData,
          createdAt: now,
          createdBy: actor,
          modifiedAt: now,
          modifiedBy: actor
        })
      )

      await tx.run(
        INSERT.into(MaterialDescriptions).entries({
          material: { matnr: materialData.matnr },
          language: { code: textData.language },
          mktx: textData.mktx
        })
      )

      return {
        matnr: materialData.matnr,
        message: 'El material se ha dado de alta junto con su primer texto.'
      }
    })

    // Actualiza o crea el texto de un material en un idioma concreto.
    this.on('updateMaterialText', async req => {
      const tx = cds.tx(req)
      const { matnr, language, mktx } = req.data

      let message = validateMaterialTextData({ language, mktx })
      if (message) return req.error(400, message)

      message = await validateMaterialPresence(tx, Materials, matnr, { mustExist: true })
      if (message) return req.error(404, message)

      message = await validateLanguagePresence(tx, language)
      if (message) return req.error(400, message)

      const existingText = await tx.run(
        SELECT.one.from(MaterialDescriptions).where`material.matnr = ${matnr} and language.code = ${language}`
      )

      if (existingText) {
        await tx.run(
          UPDATE(MaterialDescriptions)
            .set({ mktx })
            .where`material.matnr = ${matnr} and language.code = ${language}`
        )

        return {
          matnr,
          language,
          message: 'El texto del material se ha actualizado.'
        }
      }

      await tx.run(
        INSERT.into(MaterialDescriptions).entries({
          material: { matnr },
          language: { code: language },
          mktx
        })
      )

      return {
        matnr,
        language,
        message: 'El texto del material no existía y se ha creado.'
      }
    })

    // Marca un material para borrado lógico sin eliminarlo físicamente.
    this.on('flagMaterialForDeletion', async req => {
      const tx = cds.tx(req)
      const { matnr } = req.data

      const message = await validateMaterialPresence(tx, Materials, matnr, { mustExist: true })
      if (message) return req.error(404, message)

      const current = await tx.run(
        SELECT.one.from(Materials).columns('lvorm').where({ matnr })
      )

      const now = new Date()
      const actor = req.user && req.user.id ? req.user.id : DEFAULT_USER

      await tx.run(
        UPDATE(Materials)
          .set({
            lvorm: true,
            modifiedAt: now,
            modifiedBy: actor
          })
          .where({ matnr })
      )

      return {
        matnr,
        message: current && current.lvorm
          ? 'El material ya estaba marcado para borrado.'
          : 'El material se ha marcado para borrado lógico.'
      }
    })

    // Busca materiales por coincidencia parcial en el texto sin distinguir mayúsculas.
    this.on('findMaterialsByText', async req => {
      const tx = cds.tx(req)
      const { searchText } = req.data

      const message = validateSearchText(searchText)
      if (message) return req.error(400, message)

      const pattern = `%${searchText}%`
      const rows = await tx.run(
        SELECT.from(MaterialDescriptions)
          .columns(
            {
              ref: ['material'],
              expand: ['matnr', 'mtart', 'mbrsh', 'matkl', 'meins', 'brgew', 'ntgew', 'gewei', 'stprs', 'waers', 'lvorm']
            },
            { ref: ['language', 'code'], as: 'language' },
            'mktx'
          )
          .where`upper(mktx) like upper(${pattern})`
      )

      return rows.map(row => ({
        matnr: row.material?.matnr,
        mtart: row.material?.mtart,
        mbrsh: row.material?.mbrsh,
        matkl: row.material?.matkl,
        meins: row.material?.meins,
        brgew: row.material?.brgew,
        ntgew: row.material?.ntgew,
        gewei: row.material?.gewei,
        lvorm: row.material?.lvorm,
        language: row.language,
        mktx: row.mktx
      }))
    })

    // Simula el precio de un pedido usando precio estándar y escala de descuento por volumen.
    this.on('simulateOrderPricing', async req => {
      const tx = cds.tx(req)
      const matnr = normalizeMatnr(req.data.matnr)
      const language = normalizeLanguage(req.data.language)
      const quantity = Number(req.data.quantity)

      let message = validateSimulationInput(matnr, quantity, language)
      if (message) return req.error(400, message)

      const material = await tx.run(
        SELECT.one
          .from(Materials)
          .columns('matnr', 'meins', 'stprs', 'waers', 'lvorm')
          .where({ matnr })
      )

      if (!material) {
        return req.error(404, `El material ${matnr} no existe en el maestro.`)
      }

      if (material.lvorm) {
        return req.error(409, `El material ${matnr} está marcado para borrado y no admite cotización.`)
      }

      if (material.stprs == null) {
        return req.error(409, `El material ${matnr} no tiene precio estándar, así que no se puede cotizar.`)
      }

      const textRow = await tx.run(
        SELECT.one
          .from(MaterialDescriptions)
          .columns('mktx')
          .where`material.matnr = ${matnr} and language.code = ${language}`
      )

      const unitPrice = roundAmount(material.stprs)
      const roundedQuantity = roundQuantity(quantity)
      const grossAmount = roundAmount(unitPrice * roundedQuantity)
      const discountTier = resolveDiscountTier(roundedQuantity)
      const discountPct = roundAmount(discountTier.pct)
      const netAmount = roundAmount(grossAmount * (1 - discountPct / 100))

      return {
        matnr,
        description: textRow?.mktx ?? null,
        quantity: roundedQuantity,
        meins: material.meins,
        unitPrice,
        currency: material.waers ?? null,
        grossAmount,
        discountPct,
        netAmount,
        reason: discountTier.reason
      }
    })

    return super.init()
  }

}
