import type { BumpType, SemVer } from "./internal/types.ts"

/**
 * Parse a semver string into its components.
 * Strips leading `v` prefix if present.
 * Preserves prerelease suffix (e.g. "-alpha.1").
 */
export function parseVersion(version: string): SemVer {
  const cleaned = version.replace(/^v/, "")
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
  if (match) {
    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
      prerelease: match[4],
    }
  }
  // Fallback for non-standard inputs like "3"
  const parts = cleaned.split(".")
  return {
    major: Number(parts[0]) || 0,
    minor: Number(parts[1]) || 0,
    patch: Number(parts[2]) || 0,
    prerelease: parts.slice(3).join(".") || undefined,
  }
}

/**
 * Given a current version and a bump type, return the next version string.
 *
 * - If the current version has a prerelease tag and `type` is `"patch"`,
 *   the prerelease number is incremented (e.g. `1.0.0-alpha.1` → `1.0.0-alpha.2`).
 * - If the current version has a prerelease tag and `type` is `"minor"` or `"major"`,
 *   the prerelease tag is stripped and the version is bumped normally.
 * - If there is no prerelease tag, behaves as standard semver bumping.
 *
 * Accepts a SemVer object or a string like "1.2.3".
 */
export function bumpVersion(current: SemVer | string, type: BumpType): string {
  const v = typeof current === "string" ? parseVersion(current) : current

  // Prerelease patch → increment prerelease identifier
  if (v.prerelease && type === "patch") {
    const pre = v.prerelease
    const numMatch = pre.match(/^(.*?)(\d+)$/)
    const nextPre = numMatch ? `${numMatch[1]}${Number(numMatch[2]) + 1}` : `${pre}.1`
    return `${v.major}.${v.minor}.${v.patch}-${nextPre}`
  }

  // Normal bump (strips prerelease for minor/major)
  switch (type) {
    case "major":
      return `${v.major + 1}.0.0`
    case "minor":
      return `${v.major}.${v.minor + 1}.0`
    case "patch":
      return `${v.major}.${v.minor}.${v.patch + 1}`
  }
}
