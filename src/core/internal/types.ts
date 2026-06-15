/** @internal Internal-only types — not exported in public API */

export interface SemVer {
  major: number
  minor: number
  patch: number
  prerelease?: string
}

export interface Commit {
  hash: string
  message: string
}

export type ConventionalType = "breaking" | "feat" | "fix" | "other"
export type BumpType = "major" | "minor" | "patch"

export interface ReleaseOptions {
  /** Git ref to compare against (default: last tag) */
  from?: string
  /** Project root directory (default: process.cwd()) */
  cwd?: string
  /** Skip interactive confirmation prompts */
  yes?: boolean
  /** Preview only, no writes or pushes */
  dryRun?: boolean
  /** GitHub "owner/repo" override (auto-detected from git remote) */
  repo?: string
  /** Git branch to push to (default: "main") */
  branch?: string
  /** GitHub token for API access (falls back to GITHUB_TOKEN env) */
  githubToken?: string
}
