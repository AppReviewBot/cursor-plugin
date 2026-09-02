import { describe, expect, it, vi } from "vitest"
import { DEFAULT_MCP_URL, smokeMcpEndpoint } from "./mcp-smoke"

describe("smokeMcpEndpoint", () => {
  it("rejects non-arb API keys early", async () => {
    const result = await smokeMcpEndpoint({
      url: DEFAULT_MCP_URL,
      apiKey: "not-a-key"
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/arb_/)
  })

  it("reports unauthorized responses", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ error: "invalid_token" }), { status: 401 })
    ) as unknown as typeof fetch

    const result = await smokeMcpEndpoint({
      url: DEFAULT_MCP_URL,
      apiKey: "arb_test",
      fetchImpl
    })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
    expect(result.error).toMatch(/Unauthorized/)
  })

  it("parses tools/list JSON and returns tool names", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string }
      if (body.method === "initialize") {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }), {
          status: 200
        })
      }
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          result: {
            tools: [{ name: "list_apps" }, { name: "get_recent_reviews" }]
          }
        }),
        { status: 200 }
      )
    }) as unknown as typeof fetch

    const result = await smokeMcpEndpoint({
      url: DEFAULT_MCP_URL,
      apiKey: "arb_test",
      fetchImpl
    })
    expect(result.ok).toBe(true)
    expect(result.toolCount).toBe(2)
    expect(result.toolNames).toEqual(["list_apps", "get_recent_reviews"])
  })

  it("parses SSE tools/list payloads", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string }
      if (body.method === "initialize") {
        return new Response('data: {"jsonrpc":"2.0","id":1,"result":{}}\n\n', {
          status: 200
        })
      }
      return new Response(
        'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"list_apps"}]}}\n\n',
        { status: 200 }
      )
    }) as unknown as typeof fetch

    const result = await smokeMcpEndpoint({
      url: "http://localhost:8700/api/mcp",
      apiKey: "arb_test",
      fetchImpl
    })
    expect(result.ok).toBe(true)
    expect(result.toolNames).toEqual(["list_apps"])
  })
})
