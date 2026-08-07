// Este script prueba un endpoint MCP real en modo JSON-RPC 2.0 sobre HTTP.
// No basta un curl suelto porque el protocolo exige saludo: initialize,
// luego notifications/initialized, y solo después tools/list y tools/call.
// Además contempla respuestas como SSE con líneas "data:" que envuelven JSON.
// El objetivo es diagnóstico rápido: siete comprobaciones en orden y salida breve.
// Nunca corta la ejecución por un fallo para facilitar el análisis combinado.

import http from 'http'

const HOST = process.env.MCP_HOST || 'localhost'
const PORT = Number(process.env.MCP_PORT || 4004)
const PATH = process.env.MCP_PATH || '/mcp/materials'
const TIMEOUT_MS = 20000

function call (body) {
  return new Promise(resolve => {
    let settled = false
    const payload = JSON.stringify(body)

    const options = {
      host: HOST,
      port: PORT,
      path: PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(payload)
      }
    }

    const req = http.request(options, res => {
      const chunks = []

      res.on('data', chunk => chunks.push(chunk))

      res.on('end', () => {
        if (settled) return
        settled = true
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8')
        })
      })
    })

    req.setTimeout(TIMEOUT_MS, () => {
      if (settled) return
      settled = true
      req.destroy()
      resolve({
        status: 'TIMEOUT',
        body: `Tiempo de espera superado (${TIMEOUT_MS} ms)`
      })
    })

    req.on('error', err => {
      if (settled) return
      settled = true
      resolve({
        status: `ERROR:${err.code || 'UNKNOWN'}`,
        body: err.message || 'Error de red desconocido'
      })
    })

    req.write(payload)
    req.end()
  })
}

function parse (raw) {
  const text = typeof raw === 'string' ? raw : String(raw ?? '')

  try {
    return JSON.parse(text)
  } catch (_) {
    const line = text
      .split(/\r?\n/)
      .find(part => part.trim().startsWith('data:'))

    if (line) {
      const dataText = line.slice(line.indexOf('data:') + 5).trim()
      try {
        return JSON.parse(dataText)
      } catch (_) {
        return dataText || text
      }
    }

    return text
  }
}

function textOf (response) {
  const fallback = 'Sin texto en la respuesta de la herramienta'
  const blocks = response?.result?.content

  if (!Array.isArray(blocks) || blocks.length === 0) return fallback

  const firstText = blocks.find(block => typeof block?.text === 'string')
  if (!firstText) return fallback

  return firstText.text || fallback
}

;(async () => {
  const shorten = value => {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    const text = serialized || ''
    const max = 420
    return text.length > max ? `${text.slice(0, max)}...` : text
  }

  const printCheck = (title, status, result) => {
    console.log(`== ${title} ==`)
    console.log(`Estado: ${status}`)
    console.log(shorten(result))
    console.log('')
  }

  const buildCallArgs = (schema, operationName, operationArgs) => {
    const properties = schema?.properties || {}
    const propertyNames = Object.keys(properties)

    const operationKey =
      propertyNames.find(key => ['action', 'function', 'name', 'operation', 'operationName', 'method'].includes(key)) ||
      'name'

    const payloadKey =
      propertyNames.find(key => ['params', 'arguments', 'data', 'input', 'payload'].includes(key)) ||
      'arguments'

    return {
      [operationKey]: operationName,
      [payloadKey]: operationArgs
    }
  }

  const extractActionNames = schema => {
    const properties = schema?.properties || {}
    const candidates = [
      properties.action?.enum,
      properties.operation?.enum,
      properties.operationName?.enum,
      properties.name?.enum,
      schema?.definitions?.ActionName?.enum,
      schema?.$defs?.ActionName?.enum
    ]

    const firstEnum = candidates.find(item => Array.isArray(item) && item.length > 0)
    return firstEnum || []
  }

  let rpcId = 1
  const nextId = () => rpcId++

  // 1) Que el servidor MCP responde al saludo y corresponde al servicio esperado.
  let initializeParsed = null
  try {
    const initializeResponse = await call({
      jsonrpc: '2.0',
      id: nextId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'mcp-probe',
          version: '1.0.0'
        },
        capabilities: {}
      }
    })

    initializeParsed = parse(initializeResponse.body)
    const serverName =
      initializeParsed?.result?.serverInfo?.name ||
      initializeParsed?.result?.name ||
      'Nombre no informado'

    printCheck(
      '1. initialize',
      initializeResponse.status,
      `Servidor: ${serverName} | Respuesta: ${JSON.stringify(initializeParsed)}`
    )
  } catch (err) {
    printCheck('1. initialize', 'ERROR:UNCAUGHT', err?.message || String(err))
  }

  try {
    await call({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    })
  } catch (_) {}

  let callToolSchema = null

  // 2) Qué herramientas ve el agente y qué acciones expone la herramienta de invocación.
  try {
    const listResponse = await call({
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/list',
      params: {}
    })

    const listParsed = parse(listResponse.body)
    const tools = Array.isArray(listParsed?.result?.tools) ? listParsed.result.tools : []
    const toolNames = tools.map(tool => tool?.name).filter(Boolean)

    const callTool = tools.find(tool => /call/i.test(tool?.name || '')) || null
    callToolSchema = callTool?.inputSchema || null

    const actionNames = extractActionNames(callToolSchema)

    printCheck(
      '2. tools/list',
      listResponse.status,
      {
        tools: toolNames,
        actionTool: callTool?.name || 'No encontrada',
        actions: actionNames
      }
    )
  } catch (err) {
    printCheck('2. tools/list', 'ERROR:UNCAUGHT', err?.message || String(err))
  }

  // 3) Qué ve el agente al describir el modelo.
  try {
    const describeArgs = buildCallArgs(callToolSchema, 'describe', {
      entity: 'Materials'
    })

    const describeResponse = await call({
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/call',
      params: describeArgs
    })

    const describeParsed = parse(describeResponse.body)
    const describeText = textOf(describeParsed)

    printCheck(
      '3. describe sobre Materials',
      describeResponse.status,
      `${describeText} | JSON: ${JSON.stringify(describeParsed)}`
    )
  } catch (err) {
    printCheck('3. describe sobre Materials', 'ERROR:UNCAUGHT', err?.message || String(err))
  }

  // 4) Que el agente puede navegar asociaciones/composiciones con CQL.
  try {
    const queryArgs = buildCallArgs(callToolSchema, 'query', {
      statement: "SELECT from MaterialDescriptions { material.matnr as matnr, material.mtart as mtart, language.code as language, mktx } limit 5"
    })

    const queryResponse = await call({
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/call',
      params: queryArgs
    })

    const queryParsed = parse(queryResponse.body)
    const queryText = textOf(queryParsed)

    printCheck(
      '4. query con navegación de asociación',
      queryResponse.status,
      `${queryText} | JSON: ${JSON.stringify(queryParsed)}`
    )
  } catch (err) {
    printCheck('4. query con navegación de asociación', 'ERROR:UNCAUGHT', err?.message || String(err))
  }

  // 5) Que el agente puede dar de alta por acción no ligada con datos válidos.
  try {
    const registerValidArgs = buildCallArgs(callToolSchema, 'call', {
      name: 'registerMaterial',
      params: {
        matnr: 'MAT-9901',
        mtart: 'FERT',
        mbrsh: 'M',
        matkl: 'MCPTEST01',
        meins: 'ST',
        brgew: 5.5,
        ntgew: 5.1,
        gewei: 'KG',
        language: 'es',
        mktx: 'Material de prueba MCP válido',
        lvorm: false
      }
    })

    const registerValidResponse = await call({
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/call',
      params: registerValidArgs
    })

    const registerValidParsed = parse(registerValidResponse.body)
    const registerValidText = textOf(registerValidParsed)

    printCheck(
      '5. alta válida por acción',
      registerValidResponse.status,
      `${registerValidText} | JSON: ${JSON.stringify(registerValidParsed)}`
    )
  } catch (err) {
    printCheck('5. alta válida por acción', 'ERROR:UNCAUGHT', err?.message || String(err))
  }

  // 6) Que las reglas de negocio también se aplican cuando invoca un agente por MCP.
  try {
    const registerInvalidArgs = buildCallArgs(callToolSchema, 'call', {
      name: 'registerMaterial',
      params: {
        matnr: 'MAT-9902',
        mtart: 'FERT',
        mbrsh: 'M',
        matkl: 'MCPTEST02',
        meins: 'ST',
        brgew: 3,
        ntgew: 4,
        gewei: 'KG',
        language: 'es',
        mktx: 'Material inválido por pesos',
        lvorm: false
      }
    })

    const registerInvalidResponse = await call({
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/call',
      params: registerInvalidArgs
    })

    const registerInvalidParsed = parse(registerInvalidResponse.body)
    const registerInvalidText = textOf(registerInvalidParsed)

    printCheck(
      '6. alta inválida por regla de negocio',
      registerInvalidResponse.status,
      {
        expectedMessage: 'El peso neto no puede ser mayor que el peso bruto.',
        toolText: registerInvalidText,
        response: registerInvalidParsed
      }
    )
  } catch (err) {
    printCheck('6. alta inválida por regla de negocio', 'ERROR:UNCAUGHT', err?.message || String(err))
  }

  // 7) Que el agente puede consultar por función no ligada.
  try {
    const findArgs = buildCallArgs(callToolSchema, 'call', {
      name: 'findMaterialsByText',
      params: {
        searchText: 'bomba'
      }
    })

    const findResponse = await call({
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/call',
      params: findArgs
    })

    const findParsed = parse(findResponse.body)
    const findText = textOf(findParsed)

    printCheck(
      '7. función findMaterialsByText',
      findResponse.status,
      `${findText} | JSON: ${JSON.stringify(findParsed)}`
    )
  } catch (err) {
    printCheck('7. función findMaterialsByText', 'ERROR:UNCAUGHT', err?.message || String(err))
  }
})().catch(() => {
  console.log('== Error general ==')
  console.log('Estado: ERROR:UNCAUGHT')
  console.log('Se produjo un error no controlado en el cuerpo principal')
})
