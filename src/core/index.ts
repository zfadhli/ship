// ─── Public API — @zfadhli/ship ─────────────────────────────────────────
// Function-based, minimal surface, progressive complexity.

export type { ChangelogOptions } from "./changelog.ts"
export { generateChangelog } from "./changelog.ts"
export type { ClassifiedCommit, ConventionalType } from "./conventional-commits.ts"
export { classifyBump, classifyCommits } from "./conventional-commits.ts"
export { getCommits, getLastTag, getRepoUrl } from "./git.ts"
// Errors
export {
  DirtyWorktreeError,
  NoCommitsError,
  NotAuthenticatedError,
  ShipError,
} from "./internal/errors.ts"
// Types
export type { BumpType, Commit, ReleaseOptions, SemVer } from "./internal/types.ts"
// Orchestrator
export { release } from "./release.ts"
// Core functions
export { bumpVersion, parseVersion } from "./semver.ts"
