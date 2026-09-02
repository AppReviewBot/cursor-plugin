export type McpSmokeOptions = {
  url: string
  apiKey: string
  fetchImpl?: typeof fetch
}

export type McpSmokeResult = {
  ok: boolean
  status: number
  toolCount?: number
  toolNames?: string[]
  error?: string
  bodyPreview?: string
}

const INIT_BODY = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "appreviewbot-cursor-plugin-smoke", version: "1.0.0" }
  }
}

const TOOLS_LIST_BODY = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {}
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  apiKey: string,
  body: unknown
): Promise<{ status: number; text: string }> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream"
    },
    body: JSON.stringify(body)
  })
  const text = await response.text()
  return { status: response.status, text }
}

function parseJsonRpcPayload(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed)
  }
  // SSE: look for data: {...}
  const dataLine = trimmed
    .split("\n")
    .map(line => line.trim())
    .find(line => line.startsWith("data:"))
  if (!dataLine) {
    throw new Error("Response was not JSON or SSE data")
  }
  return JSON.parse(dataLine.slice("data:".length).trim())
}

/**
 * Smoke-test an AppReviewBot HTTP MCP endpoint (initialize + tools/list).
 */
export async function smokeMcpEndpoint(options: McpSmokeOptions): Promise<McpSmokeResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const { url, apiKey } = options

  if (!apiKey.startsWith("arb_")) {
    return {
      ok: false,
      status: 0,
      error: "APPREVIEWBOT_API_KEY should start with arb_"
    }
  }

  try {
    const init = await postJson(fetchImpl, url, apiKey, INIT_BODY)
    if (init.status === 401 || init.status === 403) {
      return {
        ok: false,
        status: init.status,
        error: "Unauthorized — check APPREVIEWBOT_API_KEY",
        bodyPreview: init.text.slice(0, 300)
      }
    }
    if (init.status < 200 || init.status >= 300) {
      return {
        ok: false,
        status: init.status,
        error: `initialize failed with HTTP ${init.status}`,
        bodyPreview: init.text.slice(0, 300)
      }
    }

    const tools = await postJson(fetchImpl, url, apiKey, TOOLS_LIST_BODY)
    if (tools.status < 200 || tools.status >= 300) {
      return {
        ok: false,
        status: tools.status,
        error: `tools/list failed with HTTP ${tools.status}`,
        bodyPreview: tools.text.slice(0, 300)
      }
    }

    const payload = parseJsonRpcPayload(tools.text) as {
      result?: { tools?: Array<{ name?: string }> }
      error?: { message?: string }
    }
    if (payload.error) {
      return {
        ok: false,
        status: tools.status,
        error: payload.error.message ?? "tools/list JSON-RPC error",
        bodyPreview: tools.text.slice(0, 300)
      }
    }

    const toolNames = (payload.result?.tools ?? [])
      .map(tool => tool.name)
      .filter((name): name is string => Boolean(name))

    return {
      ok: toolNames.length > 0,
      status: tools.status,
      toolCount: toolNames.length,
      toolNames,
      error: toolNames.length === 0 ? "tools/list returned no tools" : undefined
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: (error as Error).message
    }
  }
}

export const DEFAULT_MCP_URL = "https://dash.appreviewbot.com/api/mcp"
