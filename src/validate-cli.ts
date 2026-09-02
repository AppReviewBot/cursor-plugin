#!/usr/bin/env node
// CLI entry for `pnpm validate` — thin wrapper around the tested validateCursorPlugin
// in ./validate-plugin.ts. Prints issues and exits non-zero on any error-level issue.
import { defaultPluginRoot, validateCursorPlugin } from "./validate-plugin"

const result = validateCursorPlugin(defaultPluginRoot())

for (const issue of result.issues) {
  const prefix = issue.level === "error" ? "ERROR" : "WARN"
  // biome-ignore lint/suspicious/noConsole: CLI output is the point of this script.
  console[issue.level === "error" ? "error" : "warn"](`${prefix}: ${issue.message}`)
}

if (!result.ok) {
  process.exit(1)
}

// biome-ignore lint/suspicious/noConsole: CLI output is the point of this script.
console.log(
  `OK: ${result.pluginName ?? "plugin"} structure (${result.skillCount} skills, ${result.ruleCount} rules, ${result.agentCount} agents)`
)
