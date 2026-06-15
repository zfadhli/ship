import type { BumpType, SemVer } from "./internal/types.ts"

/**
 * Parse a semver string into its components.
 * Strips leading `v` prefix if present.
 */
export function parseVersion(version: string): SemVer {
  const cleaned = version.replace(/^v/, "")
  const parts = cleaned.split(".")
  const major = Number(parts[0]) || 0
  const minor = Number(parts[1]) || 0
  const patch = Number(parts[2]) || 0
  return { major, minor, patch }
}

/**
 * Given a current version and a bump type, return the next version string.
 * Accepts a SemVer object or a string like "1.2.3".
 */
export function bumpVersion(current: SemVer | string, type: BumpType): string {
  const v = typeof current === "string" ? parseVersion(current) : current
  switch (type) {
    case "major":
      return `${v.major + 1}.0.0`
    case "minor":
      return `${v.major}.${v.minor + 1}.0`
    case "patch":
      return `${v.major}.${v.minor}.${v.patch + 1}`
  }
}
