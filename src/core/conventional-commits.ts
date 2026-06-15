import type { BumpType, Commit } from "./internal/types.ts"

const FEAT_RE = /^feat(\w|\(|:)/i
const BREAKING_RE = /BREAKING CHANGE|^feat.*!:|^fix.*!:/i
const FIX_RE = /^fix(\w|\(|:)/i

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
