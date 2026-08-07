// Implementación del servicio de materiales para OData, REST y MCP.
// Las escrituras se modelan como acciones no ligadas porque el adaptador MCP
// solo invoca acciones y funciones no ligadas, no operaciones CRUD directas.
// Los handlers reutilizan las mismas validaciones para que OData y MCP apliquen
// exactamente las mismas reglas de negocio.
// Las consultas y escrituras usan CQL de CAP para mantener la lógica portable.

import cds from '@sap/cds'

const { SELECT, INSERT, UPDATE } = cds.ql

const FIELD_LENGTHS = Object.freeze({
  matnr: 18,
  mtart: 4,
  mbrsh: 1,
  matkl: 9,
  meins: 3,
  language: 14,
  mktx: 40,
  gewei: 3
})

const DEFAULT_LVORM = false
const DEFAULT_USER = 'anonymous'

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

  if (brgew != null && Number.isNaN(Number(brgew))) {
    return 'El peso bruto brgew debe ser un número válido.'
  }
  if (ntgew != null && Number.isNaN(Number(ntgew))) {
    return 'El peso neto ntgew debe ser un número válido.'
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
    const { Materials, MaterialDescriptions } = this.entities

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
              expand: ['matnr', 'mtart', 'mbrsh', 'matkl', 'meins', 'brgew', 'ntgew', 'gewei', 'lvorm']
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

    return super.init()
  }

}
