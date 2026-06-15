import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { ShipError } from "./internal/errors.ts"

// ─── types ─────────────────────────────────────────────────────────────

export type CommitType =
  | "feat"
  | "fix"
  | "docs"
  | "style"
  | "refactor"
  | "perf"
  | "test"
  | "build"
  | "ci"
  | "chore"

export type ChangesetBump = "major" | "minor" | "patch"

export interface CommitResult {
  type: CommitType
  breaking: boolean
  scope: string | undefined
  description: string
  message: string
  files: string[]
  changesetPath: string | undefined
}

// ─── public API ────────────────────────────────────────────────────────

/**
 * Stage all changes, analyze the diff, optionally create a changeset,
 * and commit with a conventional commit message.
 *
 * 1. Runs `git add -A`
 * 2. Reads `git diff --cached --name-status` to determine the commit type
 * 3. If `.changeset/config.json` exists and `src/` or `test/` files changed,
 *    creates a changeset file with a user-friendly summary
 * 4. Commits with a generated conventional commit message
 *
 * If lefthook hooks fail during commit, the output is reported verbatim.
 */
export async function createCommit(options?: {
  cwd?: string
  dryRun?: boolean
}): Promise<CommitResult> {
  const cwd = options?.cwd ?? process.cwd()

  // 1. Stage all
  execSync("git add -A", { cwd })

  // 2. Analyze staged diff
  const statusOutput = execSync("git diff --cached --name-status", {
    cwd,
    encoding: "utf-8",
  })
  const statusLines = statusOutput.trim().split("\n").filter(Boolean)

  if (statusLines.length === 0) {
    throw new ShipError("No changes to commit")
  }

  const files = statusLines.map((l) => l.slice(1).trim())
  const addedFiles = statusLines.filter((l) => l.startsWith("A")).map((l) => l.slice(1).trim())
  const _modifiedFiles = statusLines.filter((l) => l.startsWith("M")).map((l) => l.slice(1).trim())
  const _deletedFiles = statusLines.filter((l) => l.startsWith("D")).map((l) => l.slice(1).trim())

  const diffOutput = execSync("git diff --cached", {
    cwd,
    encoding: "utf-8",
  })
  const additions = diffOutput.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"))
  const removals = diffOutput.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"))

  // 3. Determine type
  const { type, breaking } = classifyChanges(statusLines, files, additions, removals)
  const description = generateDescription(files, addedFiles, type, additions)
  const scope = inferScope(files)

  // 4. Changeset
  const changesetPath = await maybeCreateChangeset(
    cwd,
    files,
    type,
    breaking,
    description,
    options?.dryRun,
  )

  // 5. Build commit message
  const commitMsg = formatMessage(type, scope, description, breaking)

  if (options?.dryRun) {
    return {
      type,
      breaking,
      scope,
      description,
      message: commitMsg,
      files,
      changesetPath,
    }
  }

  // 6. Commit
  const escapedMsg = commitMsg.replace(/"/g, '\\"')
  try {
    execSync(`git commit -m "${escapedMsg}"`, {
      cwd,
      stdio: "pipe",
      encoding: "utf-8",
    })
  } catch (err) {
    const output = (err as Error).message
    // If lefthook blocked commit, report its output
    if (/lefthook|hook(s)? failed/i.test(output)) {
      // Print lefthook output cleanly
      const hookLines = output
        .split("\n")
        .filter(
          (l) =>
            l.includes("╭") ||
            l.includes("╰") ||
            l.includes("│") ||
            l.includes("┃") ||
            l.includes("summary") ||
            l.includes("✔") ||
            l.includes("✖") ||
            l.includes("error"),
        )
        .join("\n")
      if (hookLines) console.error(hookLines)
    }
    throw new ShipError(`Commit failed — fix the issues above and try again`)
  }

  return {
    type,
    breaking,
    scope,
    description,
    message: commitMsg,
    files,
    changesetPath,
  }
}

// ─── classification ────────────────────────────────────────────────────

interface ChangeCategory {
  hasNewFiles: boolean
  hasDeletedFiles: boolean
  srcFiles: number
  testFiles: number
  docFiles: number
  ciFiles: number
  configFiles: number
}

function categorizeFiles(files: string[], statusLines: string[]): ChangeCategory {
  const hasNewFiles = statusLines.some((l) => l.startsWith("A"))
  const hasDeletedFiles = statusLines.some((l) => l.startsWith("D"))
  let srcFiles = 0
  let testFiles = 0
  let docFiles = 0
  let ciFiles = 0
  let configFiles = 0

  for (const f of files) {
    if (f.startsWith("src/")) srcFiles++
    else if (f.startsWith("test/")) testFiles++
    else if (f.endsWith(".md") || f.startsWith("docs/")) docFiles++
    else if (f.startsWith(".github/")) ciFiles++
    else if (
      [
        "package.json",
        "biome.json",
        "tsconfig.json",
        "tsdown.config.ts",
        ".gitignore",
        "lefthook.yml",
      ].includes(f)
    )
      configFiles++
  }

  return { hasNewFiles, hasDeletedFiles, srcFiles, testFiles, docFiles, ciFiles, configFiles }
}

const FIX_KEYWORDS = /\b(fix|bug|crash|error|issue|fail|broken|edge case|regression)\b/i
const FEAT_KEYWORDS = /\b(feat|add|new|introduce|implement|support|create)\b/i
const PERF_KEYWORDS = /\b(perf|performance|speed|fast|slow|optimize|bottleneck)\b/i

function classifyChanges(
  statusLines: string[],
  files: string[],
  additions: string[],
  removals: string[],
): { type: CommitType; breaking: boolean } {
  const cats = categorizeFiles(files, statusLines)
  const addedText = additions.join(" ")
  const removedText = removals.join(" ")

  const breaking =
    /\bBREAKING\s*CHANGE\b/i.test(addedText) || /\bBREAKING\s*CHANGE\b/i.test(removedText)

  // Heuristic classification by priority
  if (cats.hasDeletedFiles && cats.srcFiles > 0 && breaking) {
    return { type: "feat", breaking: true }
  }

  if (cats.hasNewFiles && cats.srcFiles > 0) {
    return { type: "feat", breaking }
  }

  if (cats.srcFiles > 0 && FIX_KEYWORDS.test(addedText)) {
    return { type: "fix", breaking }
  }

  if (cats.srcFiles > 0 && PERF_KEYWORDS.test(addedText)) {
    return { type: "perf", breaking }
  }

  if (cats.srcFiles > 0 && FEAT_KEYWORDS.test(addedText)) {
    return { type: "feat", breaking }
  }

  if (cats.testFiles > 0 && cats.srcFiles === 0) {
    return { type: "test", breaking }
  }

  if (cats.docFiles > 0 && cats.srcFiles === 0) {
    return { type: "docs", breaking }
  }

  if (cats.ciFiles > 0) {
    return { type: "ci", breaking }
  }

  if (cats.configFiles > 0 && cats.srcFiles === 0) {
    return { type: "chore", breaking }
  }

  if (cats.srcFiles > 0) {
    return { type: "refactor", breaking }
  }

  return { type: "chore", breaking }
}

// ─── description & scope ───────────────────────────────────────────────

function generateDescription(
  files: string[],
  addedFiles: string[],
  type: CommitType,
  _additions: string[],
): string {
  // Try to extract a meaningful description from the diff
  const fileList = files
    .map((f) => f.split("/").pop() || f)
    .filter(Boolean)
    .slice(0, 3)
  const fileText = fileList.join(", ")
  const count = files.length
  const hasNew = addedFiles.length > 0
  const newFiles = addedFiles
    .map((f) => f.split("/").pop() || f)
    .filter(Boolean)
    .slice(0, 2)

  switch (type) {
    case "feat":
      if (hasNew && newFiles.length > 0) {
        return `add ${newFiles.join(", ")}${count > newFiles.length ? ` and more` : ""}`
      }
      return `add ${fileText}`
    case "fix":
      return `fix ${fileText}`
    case "perf":
      return `improve performance of ${fileText}`
    case "refactor":
      return `refactor ${fileText}`
    case "test":
      return count === 1 ? `add test for ${fileText}` : `add ${count} tests`
    case "docs":
      return `update documentation`
    case "ci":
      return `update CI configuration`
    case "chore":
      return `update dependencies and config`
    default:
      return `update ${count} file${count !== 1 ? "s" : ""}`
  }
}

function inferScope(files: string[]): string | undefined {
  // Infer scope from the most common top-level directory
  const dirs = files
    .map((f) => f.split("/")[0])
    .filter((d): d is string => d !== undefined && d !== "." && d !== "..")
  if (dirs.length === 0) return undefined

  const counts = new Map<string, number>()
  for (const d of dirs) {
    counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  let maxCount = 0
  let maxDir: string | undefined
  for (const [d, c] of counts) {
    if (c > maxCount) {
      maxCount = c
      maxDir = d
    }
  }
  return maxDir
}

// ─── changeset ─────────────────────────────────────────────────────────

function classifyBumpFromType(type: CommitType, breaking: boolean): ChangesetBump {
  if (breaking) return "major"
  if (type === "feat") return "minor"
  return "patch"
}

function generateChangesetSummary(files: string[], type: CommitType, description: string): string {
  const scope = inferScope(files)
  const area = scope ? ` in ${scope}` : ""
  switch (type) {
    case "feat":
      return `Added new feature${area}: ${description}`
    case "fix":
      return `Fixed an issue${area}: ${description}`
    case "perf":
      return `Performance improvement${area}: ${description}`
    case "refactor":
      return `Refactored${area}: ${description}`
    case "test":
      return `Added tests${area}: ${description}`
    case "docs":
      return `Updated documentation${area}`
    case "ci":
      return `Updated CI configuration${area}`
    default:
      return `Updated${area}: ${description}`
  }
}

async function maybeCreateChangeset(
  cwd: string,
  files: string[],
  type: CommitType,
  breaking: boolean,
  description: string,
  dryRun?: boolean,
): Promise<string | undefined> {
  const configPath = resolve(cwd, ".changeset", "config.json")
  if (!existsSync(configPath)) return undefined

  const modifiesSrcOrTest = files.some((f) => f.startsWith("src/") || f.startsWith("test/"))
  if (!modifiesSrcOrTest) return undefined

  const pkgRaw = await readFile(resolve(cwd, "package.json"), "utf-8")
  const pkgName = (JSON.parse(pkgRaw) as { name: string }).name
  const bump = classifyBumpFromType(type, breaking)
  const summary = generateChangesetSummary(files, type, description)

  const changesetDir = resolve(cwd, ".changeset")
  if (!existsSync(changesetDir)) {
    if (!dryRun) await mkdir(changesetDir, { recursive: true })
  }

  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  const filename = `${timestamp}-${random}.md`
  const changesetPath = resolve(changesetDir, filename)

  const content = `---
"${pkgName}": ${bump}
---

${summary}
`

  if (!dryRun) {
    await writeFile(changesetPath, content, "utf-8")
    execSync("git add .changeset/", { cwd })
  }

  return filename
}

// ─── message formatting ────────────────────────────────────────────────

function formatMessage(
  type: CommitType,
  scope: string | undefined,
  description: string,
  breaking: boolean,
): string {
  const scopePart = scope ? `(${scope})` : ""
  const bang = breaking ? "!" : ""
  return `${type}${scopePart}${bang}: ${description}`
}
