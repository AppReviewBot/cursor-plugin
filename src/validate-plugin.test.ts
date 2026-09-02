import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { defaultPluginRoot, validateCursorPlugin } from "./validate-plugin"

function writeMinimalPlugin(
  root: string,
  overrides?: { badName?: boolean; manifest?: Record<string, unknown> }
) {
  mkdirSync(join(root, ".cursor-plugin"), { recursive: true })
  mkdirSync(join(root, "skills", "demo"), { recursive: true })
  mkdirSync(join(root, "rules"), { recursive: true })
  mkdirSync(join(root, "assets"), { recursive: true })
  writeFileSync(join(root, "assets", "logo.png"), "png")
  const manifest = {
    name: overrides?.badName ? "Bad Name" : "demo-plugin",
    displayName: "Demo",
    version: "1.0.0",
    description: "Demo plugin",
    license: "MIT",
    author: { name: "AppReviewBot" },
    logo: "assets/logo.png",
    ...overrides?.manifest
  }
  writeFileSync(join(root, ".cursor-plugin", "plugin.json"), JSON.stringify(manifest))
  writeFileSync(
    join(root, ".cursor-plugin", "marketplace.json"),
    JSON.stringify({
      name: "demo-marketplace",
      owner: { name: "AppReviewBot", email: "hello@appreviewbot.com" },
      metadata: { description: "Demo", version: "1.0.0" },
      plugins: [{ name: "demo-plugin", source: ".", description: "Demo" }]
    })
  )
  writeFileSync(
    join(root, "mcp.json"),
    JSON.stringify({
      mcpServers: {
        demo: {
          type: "http",
          url: "https://dash.appreviewbot.com/api/mcp",
          auth: { scopes: ["mcp:read", "mcp:write"] }
        }
      }
    })
  )
  writeFileSync(
    join(root, "skills", "demo", "SKILL.md"),
    "---\nname: demo\ndescription: Demo skill\n---\n\n# Demo\n"
  )
  writeFileSync(
    join(root, "rules", "demo.mdc"),
    "---\ndescription: Demo rule\nalwaysApply: true\n---\n\nBe careful.\n"
  )
  writeFileSync(join(root, "README.md"), "# Demo\n")
}

describe("validateCursorPlugin", () => {
  it("passes for the real AppReviewBot cursor plugin with no warnings either", () => {
    const result = validateCursorPlugin(defaultPluginRoot())
    expect(result.ok).toBe(true)
    expect(result.pluginName).toBe("appreviewbot")
    expect(result.skillCount).toBeGreaterThanOrEqual(5)
    expect(result.agentCount).toBeGreaterThanOrEqual(1)
    expect(result.ruleCount).toBeGreaterThanOrEqual(1)
    expect(result.issues).toEqual([])
  })

  it("accepts a minimal valid plugin fixture", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root)
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(true)
    expect(result.skillCount).toBe(1)
  })

  it("rejects invalid plugin names", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, { badName: true })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.message.includes("kebab-case"))).toBe(true)
  })

  it("rejects a manifest missing required string fields", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, { manifest: { version: undefined, license: "" } })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.message === "plugin.json missing string field: version")).toBe(
      true
    )
    expect(result.issues.some(i => i.message === "plugin.json missing string field: license")).toBe(
      true
    )
  })

  it("rejects a manifest missing author.name", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, { manifest: { author: undefined } })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.message === "plugin.json author.name is required")).toBe(true)
  })

  it("rejects author with a blank name", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, { manifest: { author: { name: "  " } } })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.message === "plugin.json author.name is required")).toBe(true)
  })

  it("warns when the manifest has no logo", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, { manifest: { logo: undefined } })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(true)
    expect(
      result.issues.some(
        i =>
          i.level === "warning" &&
          i.message === "plugin.json has no logo (recommended for marketplace)"
      )
    ).toBe(true)
  })

  it("rejects a non-string logo", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, { manifest: { logo: 42 } })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.message === "plugin.json logo must be a string path")).toBe(
      true
    )
  })

  it("rejects a logo path containing ..", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, { manifest: { logo: "../outside/logo.png" } })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.message === "plugin.json logo must not contain ..")).toBe(true)
  })

  it("warns on a non-https logo URL", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, { manifest: { logo: "http://example.com/logo.png" } })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(true)
    expect(
      result.issues.some(
        i => i.level === "warning" && i.message === "plugin.json logo should use https://"
      )
    ).toBe(true)
  })

  it("accepts an https logo URL with no issue", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, { manifest: { logo: "https://example.com/logo.png" } })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(true)
    expect(result.issues.some(i => i.message.startsWith("plugin.json logo"))).toBe(false)
  })

  it("rejects a logo file that isn't on disk", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, { manifest: { logo: "assets/missing-logo.png" } })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(false)
    expect(
      result.issues.some(i => i.message === "Logo file not found: assets/missing-logo.png")
    ).toBe(true)
  })

  it("rejects variables that aren't a JSON Schema object with properties", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, { manifest: { variables: { type: "string" } } })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(false)
    expect(
      result.issues.some(
        i => i.message === "variables must be a JSON Schema object with properties"
      )
    ).toBe(true)
  })

  it("accepts variables that are a valid JSON Schema object with properties", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root, {
      manifest: {
        variables: {
          type: "object",
          properties: { apiKey: { type: "string" } },
          required: ["apiKey"]
        }
      }
    })
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(true)
    expect(result.issues.some(i => i.message.includes("variables must be"))).toBe(false)
  })

  it("rejects missing mcp.json", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root)
    unlinkSync(join(root, "mcp.json"))
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.message.includes("mcp.json"))).toBe(true)
  })

  it("treats a bare { type: http, url } MCP server as the correct OAuth-discovery shape", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root)
    writeFileSync(
      join(root, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          demo: { type: "http", url: "https://dash.appreviewbot.com/api/mcp" }
        }
      })
    )
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it("rejects a static Authorization header on an MCP server", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root)
    writeFileSync(
      join(root, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          demo: {
            type: "http",
            url: "https://dash.appreviewbot.com/api/mcp",
            headers: { Authorization: "Bearer sk-live-hardcoded" }
          }
        }
      })
    )
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(false)
    expect(result.issues.some(i => i.level === "error" && i.message.includes("static value"))).toBe(
      true
    )
  })

  it("accepts an Authorization header that uses a ${VAR} placeholder", () => {
    const root = mkdtempSync(join(tmpdir(), "arb-cursor-plugin-"))
    writeMinimalPlugin(root)
    writeFileSync(
      join(root, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          demo: {
            type: "http",
            url: "https://dash.appreviewbot.com/api/mcp",
            headers: { Authorization: "Bearer ${APPREVIEWBOT_API_KEY}" }
          }
        }
      })
    )
    const result = validateCursorPlugin(root)
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })
})
