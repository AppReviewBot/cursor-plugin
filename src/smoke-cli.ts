#!/usr/bin/env node
// CLI entry for `pnpm smoke` — thin wrapper around the tested smokeMcpEndpoint in
// ./mcp-smoke.ts. Requires APPREVIEWBOT_API_KEY; APPREVIEWBOT_MCP_URL overrides the
// default public endpoint for local/dev testing only.
import { DEFAULT_MCP_URL, smokeMcpEndpoint } from "./mcp-smoke"

const apiKey = process.env.APPREVIEWBOT_API_KEY
const url = process.env.APPREVIEWBOT_MCP_URL || DEFAULT_MCP_URL

if (!apiKey) {
  // biome-ignore lint/suspicious/noConsole: CLI output is the point of this script.
  console.error("Set APPREVIEWBOT_API_KEY (org key starting with arb_) to run the live smoke test.")
  // biome-ignore lint/suspicious/noConsole: CLI output is the point of this script.
  console.error("Example: APPREVIEWBOT_API_KEY=arb_xxx pnpm smoke")
  process.exit(2)
}

const result = await smokeMcpEndpoint({ url, apiKey })

if (!result.ok) {
  // biome-ignore lint/suspicious/noConsole: CLI output is the point of this script.
  console.error(`SMOKE FAILED: ${result.error ?? `HTTP ${result.status}`}`)
  if (result.bodyPreview) {
    // biome-ignore lint/suspicious/noConsole: CLI output is the point of this script.
    console.error(result.bodyPreview)
  }
  process.exit(1)
}

// biome-ignore lint/suspicious/noConsole: CLI output is the point of this script.
console.log(`SMOKE OK: ${result.toolCount} tools from ${url}`)
// biome-ignore lint/suspicious/noConsole: CLI output is the point of this script.
console.log((result.toolNames ?? []).join(", "))
