import type { BumpType, Commit } from "./internal/types.ts"

const CONVENTIONAL_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const

const CONVENTIONAL_RE = new RegExp(`^(${CONVENTIONAL_TYPES.join("|")})(\\([\\w-]+\\))?!?:\\s`)

const FEAT_RE = /^feat(\w|\(|:)/i
const BREAKING_RE = /BREAKING CHANGE|^feat.*!:|^fix.*!:/i
const FIX_RE = /^fix(\w|\(|:)/i

export interface CommitWarning {
  hash: string
  message: string
  reason: string
}

/**
 * Validate commits against the conventional commit format.
 * Returns a warning for each commit that doesn't match.
 */
export function validateCommits(commits: Commit[]): CommitWarning[] {
  const warnings: CommitWarning[] = []
  for (const c of commits) {
    if (CONVENTIONAL_RE.test(c.message)) continue
    // Skip merge commits and release commits
    if (/^Merge /.test(c.message)) continue
    if (/^Release v/.test(c.message)) continue

    const hasPrefix = /^[\w-]+(\([\w-]+\))?!?:\s/.test(c.message)
    if (hasPrefix) {
      const type = c.message.match(/^([\w-]+)/)?.[1]
      warnings.push({
        hash: c.hash,
        message: c.message,
        reason: `Unrecognized type "${type}". Expected: ${CONVENTIONAL_TYPES.join(", ")}`,
      })
    } else {
      warnings.push({
        hash: c.hash,
        message: c.message,
        reason: "Does not match conventional commit format: type(scope)?: description",
      })
    }
  }
  return warnings
}

/**
 * Classify an array of conventional commits and determine the required
 * semver bump type. Priority: major > minor > patch.
 */
export function classifyBump(commits: Commit[]): BumpType {
  let hasMajor = false
  let hasMinor = false

  for (const commit of commits) {
    if (BREAKING_RE.test(commit.message)) {
      hasMajor = true
    } else if (FEAT_RE.test(commit.message)) {
      hasMinor = true
    }
  }

  if (hasMajor) return "major"
  if (hasMinor) return "minor"
  return "patch"
}

export interface ClassifiedCommit {
  hash: string
  message: string
  body: string
  type: "breaking" | "feat" | "fix" | "other"
}

export type ConventionalType = ClassifiedCommit["type"]

/**
 * Parse commits and classify each one by conventional commit type.
 */
export function classifyCommits(commits: Commit[]): ClassifiedCommit[] {
  return commits.map((c) => {
    const body = c.message.includes(": ") ? c.message.slice(c.message.indexOf(": ") + 2) : c.message
    let type: ClassifiedCommit["type"]
    if (BREAKING_RE.test(c.message)) {
      type = "breaking"
    } else if (FEAT_RE.test(c.message)) {
      type = "feat"
    } else if (FIX_RE.test(c.message)) {
      type = "fix"
    } else {
      type = "other"
    }
    return { hash: c.hash, message: c.message, body, type }
  })
}
