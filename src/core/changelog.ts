import type { ClassifiedCommit } from "./conventional-commits.ts"

export interface ChangelogOptions {
  version: string
  date?: string
  repoUrl: string
}

/**
 * Generate a new changelog section for the given version.
 * Returns markdown text ready to be prepended to CHANGELOG.md.
 */
export function generateChangelog(commits: ClassifiedCommit[], options: ChangelogOptions): string {
  const date = options.date ?? new Date().toISOString().slice(0, 10)

  let section = `## [${options.version}] - ${date}\n`

  const feats = commits.filter((c) => c.type === "feat" || c.type === "breaking")
  const fixes = commits.filter((c) => c.type === "fix")
  const other = commits.filter((c) => c.type === "other")

  if (feats.length > 0) {
    section += `\n### Features\n\n`
    section += `${feats
      .map((c) => `- ${c.body} ([${c.hash.slice(0, 7)}](${options.repoUrl}/commit/${c.hash}))`)
      .join("\n")}\n`
  }
  if (fixes.length > 0) {
    section += `\n### Bug Fixes\n\n`
    section += `${fixes
      .map((c) => `- ${c.body} ([${c.hash.slice(0, 7)}](${options.repoUrl}/commit/${c.hash}))`)
      .join("\n")}\n`
  }
  if (other.length > 0) {
    section += `\n### Other Changes\n\n`
    section += `${other
      .map((c) => `- ${c.body} ([${c.hash.slice(0, 7)}](${options.repoUrl}/commit/${c.hash}))`)
      .join("\n")}\n`
  }

  section += "\n"
  return section
}
