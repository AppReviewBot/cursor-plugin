#!/usr/bin/env node
/**
 * Inspect Cursor MCP auth state for AppReviewBot (no secrets printed).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const serverId = "plugin-appreviewbot-appreviewbot"
const cursorProjects = join(homedir(), ".cursor", "projects")

function findMcpAuthFiles() {
  const hits = []
  if (!existsSync(cursorProjects)) return hits
  for (const dir of readdirSync(cursorProjects)) {
    const path = join(cursorProjects, dir, "mcp-auth.json")
    if (existsSync(path)) hits.push({ project: dir, path })
  }
  return hits
}

function findMcpsCaches() {
  const hits = []
  if (!existsSync(cursorProjects)) return hits
  for (const dir of readdirSync(cursorProjects)) {
    const mcpsDir = join(cursorProjects, dir, "mcps", serverId)
    if (existsSync(mcpsDir)) {
      const tools = existsSync(join(mcpsDir, "tools"))
        ? readdirSync(join(mcpsDir, "tools")).filter(f => f.endsWith(".json")).length
        : 0
      hits.push({ project: dir, tools, hasStatus: existsSync(join(mcpsDir, "STATUS.md")) })
    }
  }
  return hits
}

console.log("AppReviewBot Cursor MCP auth check\n")

const authFiles = findMcpAuthFiles()
const mcpsCaches = findMcpsCaches()

if (!authFiles.length) {
  console.log("No mcp-auth.json files found under ~/.cursor/projects/")
} else {
  for (const { project, path } of authFiles) {
    const json = JSON.parse(readFileSync(path, "utf8"))
    const entry = json[serverId]
    if (!entry) {
      console.log(`[${project}] no ${serverId} entry`)
      continue
    }
    const keys = Object.keys(entry)
    console.log(`[${project}] mcp-auth keys: ${keys.join(", ") || "(empty)"}`)
    if (entry.clientInfo?.client_id) {
      console.log(`  client_id: ${entry.clientInfo.client_id}`)
    }
    if (entry.tokens || entry.accessToken || entry.access_token) {
      console.log("  tokens: present in file")
    } else {
      console.log("  tokens: not in mcp-auth.json (normal — Cursor uses secure storage)")
    }
  }
}

console.log("")
if (!mcpsCaches.length) {
  console.log("No MCP tool caches for AppReviewBot")
} else {
  for (const row of mcpsCaches) {
    console.log(
      `[${row.project}] tools cached: ${row.tools}, STATUS.md (needs auth): ${row.hasStatus}`
    )
  }
}

console.log("\nIf tools are cached but agent says needsAuth:")
console.log("  1. Reload Window in the workspace where you connected")
console.log("  2. Start a NEW chat (this thread may not pick up tokens)")
console.log("  3. Settings → MCP → appreviewbot must show Connected")
