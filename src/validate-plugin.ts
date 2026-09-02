import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export type ValidationIssue = {
  level: "error" | "warning"
  message: string
}

export type ValidationResult = {
  ok: boolean
  issues: ValidationIssue[]
  pluginName?: string
  skillCount: number
  ruleCount: number
  agentCount: number
}

const PLUGIN_NAME_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"))
}

function hasFrontmatter(content: string): boolean {
  return content.startsWith("---\n") || content.startsWith("---\r\n")
}

function frontmatterHas(content: string, keys: string[]): boolean {
  const end = content.indexOf("\n---", 3)
  if (end < 0) return false
  const block = content.slice(3, end)
  return keys.every(key => new RegExp(`^${key}\\s*:`, "m").test(block))
}

/**
 * Validate the required string fields (name, displayName, version, description,
 * license, author.name). Returns the plugin name (if valid) for the caller to report.
 */
function validateManifestFields(
  manifest: Record<string, unknown>,
  issues: ValidationIssue[]
): string | undefined {
  const name = typeof manifest.name === "string" ? manifest.name : ""
  if (!name || !PLUGIN_NAME_RE.test(name)) {
    issues.push({
      level: "error",
      message: `plugin.json name must be lowercase kebab-case (got "${name}")`
    })
  }

  for (const field of ["displayName", "version", "description", "license"] as const) {
    if (typeof manifest[field] !== "string" || !(manifest[field] as string).trim()) {
      issues.push({ level: "error", message: `plugin.json missing string field: ${field}` })
    }
  }

  const author = manifest.author as { name?: string } | undefined
  if (!author || typeof author.name !== "string" || !author.name.trim()) {
    issues.push({ level: "error", message: "plugin.json author.name is required" })
  }

  return name || undefined
}

/**
 * Validate the optional `logo`: missing (warning), non-string, `..`
 * traversal, http(s) URL (warns if not https), or a path that must exist.
 */
function validateManifestLogo(
  root: string,
  manifest: Record<string, unknown>,
  issues: ValidationIssue[]
): void {
  if (!manifest.logo) {
    issues.push({
      level: "warning",
      message: "plugin.json has no logo (recommended for marketplace)"
    })
    return
  }
  if (typeof manifest.logo !== "string") {
    issues.push({ level: "error", message: "plugin.json logo must be a string path" })
    return
  }
  if (manifest.logo.includes("..")) {
    issues.push({ level: "error", message: "plugin.json logo must not contain .." })
    return
  }
  if (/^https?:\/\//i.test(manifest.logo)) {
    if (!/^https:\/\//i.test(manifest.logo)) {
      issues.push({ level: "warning", message: "plugin.json logo should use https://" })
    }
    return
  }
  if (!existsSync(join(root, manifest.logo))) {
    issues.push({ level: "error", message: `Logo file not found: ${manifest.logo}` })
  }
}

/** Validate the manifest's optional `variables` JSON Schema shape. */
function validateManifestVariables(
  manifest: Record<string, unknown>,
  issues: ValidationIssue[]
): void {
  const variables = manifest.variables as
    | { type?: string; properties?: Record<string, unknown>; required?: string[] }
    | undefined
  if (!variables) return
  if (variables.type !== "object" || !variables.properties) {
    issues.push({
      level: "error",
      message: "variables must be a JSON Schema object with properties"
    })
  }
}

/**
 * Validate .cursor-plugin/plugin.json. Returns issues plus the plugin name (if any),
 * so the caller can report it without re-reading the manifest.
 */
function validateManifest(root: string, issues: ValidationIssue[]): string | undefined {
  const manifestPath = join(root, ".cursor-plugin", "plugin.json")
  if (!existsSync(manifestPath)) {
    issues.push({ level: "error", message: "Missing .cursor-plugin/plugin.json" })
    return undefined
  }

  let manifest: Record<string, unknown>
  try {
    manifest = readJson(manifestPath) as Record<string, unknown>
  } catch (error) {
    issues.push({
      level: "error",
      message: `Invalid plugin.json JSON: ${(error as Error).message}`
    })
    return undefined
  }

  const name = validateManifestFields(manifest, issues)
  validateManifestLogo(root, manifest, issues)
  validateManifestVariables(manifest, issues)

  return name
}

type McpServerConfig = {
  url?: string
  headers?: Record<string, string>
  auth?: { scopes?: string[]; CLIENT_ID?: string }
}

/**
 * Bare OAuth-discovery entries aren't warnings; static Authorization headers always
 * are — a hardcoded credential in mcp.json would ship as a public secret.
 */
function validateMcpServerEntry(
  serverName: string,
  server: McpServerConfig,
  issues: ValidationIssue[]
): void {
  if (!server.url || typeof server.url !== "string") {
    issues.push({ level: "error", message: `mcpServers.${serverName} needs a url` })
    return
  }

  const usesOAuth = Boolean(server.auth?.scopes?.length || server.auth?.CLIENT_ID)
  const authHeader = server.headers?.Authorization

  if (usesOAuth) {
    if (authHeader) {
      issues.push({
        level: "error",
        message: `mcpServers.${serverName} must not combine OAuth discovery with a static Authorization header`
      })
    }
    return
  }

  if (!authHeader) return

  const usesPlaceholder = authHeader.includes("${")
  if (!usesPlaceholder) {
    issues.push({
      level: "error",
      message: `mcpServers.${serverName} Authorization must use a \${VAR} placeholder, not a static value`
    })
  }
}

function validateMcpConfig(root: string, issues: ValidationIssue[]): void {
  const mcpPath = join(root, "mcp.json")
  if (!existsSync(mcpPath)) {
    issues.push({ level: "error", message: "Missing mcp.json" })
    return
  }

  try {
    const mcp = readJson(mcpPath) as { mcpServers?: Record<string, unknown> }
    if (!mcp.mcpServers || typeof mcp.mcpServers !== "object") {
      issues.push({ level: "error", message: "mcp.json must contain mcpServers object" })
      return
    }
    for (const [serverName, config] of Object.entries(mcp.mcpServers)) {
      validateMcpServerEntry(serverName, config as McpServerConfig, issues)
    }
  } catch (error) {
    issues.push({
      level: "error",
      message: `Invalid mcp.json JSON: ${(error as Error).message}`
    })
  }
}

function validateSkillsDir(root: string, issues: ValidationIssue[]): number {
  const skillsDir = join(root, "skills")
  if (!existsSync(skillsDir)) {
    issues.push({ level: "warning", message: "No skills/ directory" })
    return 0
  }

  let skillCount = 0
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillPath = join(skillsDir, entry.name, "SKILL.md")
    if (!existsSync(skillPath)) {
      issues.push({ level: "error", message: `Skill directory ${entry.name} missing SKILL.md` })
      continue
    }
    skillCount += 1
    const content = readFileSync(skillPath, "utf8")
    if (!hasFrontmatter(content) || !frontmatterHas(content, ["name", "description"])) {
      issues.push({
        level: "error",
        message: `skills/${entry.name}/SKILL.md needs name + description frontmatter`
      })
    }
  }
  return skillCount
}

function validateMarkdownDir(
  root: string,
  dirName: string,
  requiredKeys: string[],
  issues: ValidationIssue[]
): number {
  const dir = join(root, dirName)
  if (!existsSync(dir)) return 0

  let count = 0
  for (const file of readdirSync(dir)) {
    if (!/\.(md|mdc|markdown)$/i.test(file)) continue
    count += 1
    const content = readFileSync(join(dir, file), "utf8")
    if (!hasFrontmatter(content) || !frontmatterHas(content, requiredKeys)) {
      issues.push({
        level: "error",
        message: `${dirName}/${file} needs ${requiredKeys.join(" + ")} frontmatter`
      })
    }
  }
  return count
}

/**
 * Validate a Cursor plugin directory against marketplace structural requirements.
 */
export function validateCursorPlugin(pluginRoot: string): ValidationResult {
  const issues: ValidationIssue[] = []
  const root = resolve(pluginRoot)

  const marketplacePath = join(root, ".cursor-plugin", "marketplace.json")
  const manifestPath = join(root, ".cursor-plugin", "plugin.json")
  if (!existsSync(manifestPath)) {
    issues.push({ level: "error", message: "Missing .cursor-plugin/plugin.json" })
    return { ok: false, issues, skillCount: 0, ruleCount: 0, agentCount: 0 }
  }
  if (!existsSync(marketplacePath)) {
    issues.push({
      level: "error",
      message: "Missing .cursor-plugin/marketplace.json (required for Cursor repo import)"
    })
  }

  const name = validateManifest(root, issues)
  validateMcpConfig(root, issues)
  const skillCount = validateSkillsDir(root, issues)
  const ruleCount = validateMarkdownDir(root, "rules", ["description"], issues)
  const agentCount = validateMarkdownDir(root, "agents", ["name", "description"], issues)

  if (!existsSync(join(root, "README.md"))) {
    issues.push({ level: "warning", message: "Missing README.md" })
  }

  const ok = !issues.some(issue => issue.level === "error")
  return { ok, issues, pluginName: name, skillCount, ruleCount, agentCount }
}

export function defaultPluginRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  return resolve(here, "..")
}
