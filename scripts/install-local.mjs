#!/usr/bin/env node
/**
 * Copy plugin payload into ~/.cursor/plugins/local/appreviewbot
 *
 * Cursor rejects symlinks whose target is outside ~/.cursor/plugins/local,
 * so we rsync the plugin files instead of ln -s.
 */
import { cpSync, existsSync, lstatSync, mkdirSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const localDir = join(homedir(), ".cursor", "plugins", "local")
const target = join(localDir, "appreviewbot")

const COPY_PATHS = [
  ".cursor-plugin",
  "agents",
  "assets",
  "mcp.json",
  "rules",
  "skills"
]

function removeTarget() {
  try {
    lstatSync(target)
    rmSync(target, { recursive: true, force: true })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
      throw error
    }
  }
}

mkdirSync(localDir, { recursive: true })
removeTarget()
mkdirSync(target, { recursive: true })

for (const rel of COPY_PATHS) {
  const src = join(pluginRoot, rel)
  if (!existsSync(src)) {
    console.error(`Missing required plugin path: ${rel}`)
    process.exit(1)
  }
  cpSync(src, join(target, rel), { recursive: true })
}

console.log(`Installed local Cursor plugin (copied):\n  ${target}`)
console.log("")
console.log("Next steps:")
console.log("1. Cursor Settings → enable \"Include third-party Plugins, Skills, and other configs\"")
console.log("2. Cmd/Ctrl+Shift+P → Developer: Reload Window")
console.log("3. Settings → MCP → appreviewbot → Connect (OAuth)")
