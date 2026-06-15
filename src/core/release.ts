import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { generateChangelog } from "./changelog.ts"
import type { ClassifiedCommit, CommitWarning } from "./conventional-commits.ts"
import { classifyBump, classifyCommits, validateCommits } from "./conventional-commits.ts"
import {
  checkCleanWorktree,
  createCommit,
  createTag,
  getCommits,
  getLastTag,
  getRepoUrl,
  push,
  pushTag,
  stageAll,
} from "./git.ts"
import { checkAuth, createRelease, extractRepo } from "./github.ts"
import { NoCommitsError } from "./internal/errors.ts"
import type { BumpType, ReleaseOptions } from "./internal/types.ts"
import { bumpVersion } from "./semver.ts"

export interface PreviewResult {
  lastTag: string
  commits: ClassifiedCommit[]
  bump: BumpType
  oldVersion: string
  newVersion: string
  repoUrl: string
  cwd: string
  warnings: CommitWarning[]
}

/**
 * Analyze the current state without making any changes.
 * Returns version info, commit list, and repo URL.
 * Throws if gh is not authenticated or no commits since the ref.
 */
export async function preview(options: ReleaseOptions = {}): Promise<PreviewResult> {
  const cwd = options.cwd ?? process.cwd()

  await checkAuth({ githubToken: options.githubToken, repo: options.repo })

  const lastTag = await getLastTag(cwd)
  const rawCommits = await getCommits({
    from: options.from ?? lastTag,
    cwd,
  })

  if (rawCommits.length === 0) {
    throw new NoCommitsError(options.from ?? lastTag)
  }

  const classified = classifyCommits(rawCommits)
  const bump = classifyBump(rawCommits)
  const warnings = validateCommits(rawCommits)

  const pkgPath = resolve(cwd, "package.json")
  const pkgRaw = await readFile(pkgPath, "utf-8")
  const pkg = JSON.parse(pkgRaw) as { version: string }
  const oldVersion = pkg.version
  const newVersion = bumpVersion(oldVersion, bump)

  const repoUrl = options.repo ? `https://github.com/${options.repo}` : await getRepoUrl(cwd)

  return { lastTag, commits: classified, bump, oldVersion, newVersion, repoUrl, cwd, warnings }
}

/**
 * Run the full release flow:
 *
 * 1. Analyze via {@link preview}
 * 2. Update `package.json` version
 * 3. Generate changelog section, prepend to `CHANGELOG.md`
 * 4. Commit, tag, push
 * 5. Create GitHub Release
 *
 * Pass `{ dryRun: true }` to preview without making changes.
 *
 * The caller is responsible for any user-facing prompts.
 * Use {@link preview} separately to show previews before calling `release`.
 */
export async function release(options: ReleaseOptions = {}): Promise<void> {
  const state = await preview(options)
  const { cwd, commits: classified, newVersion, repoUrl } = state

  if (!options.dryRun) {
    await checkCleanWorktree(cwd)
  }

  if (options.dryRun) {
    return
  }

  // 1. Update package.json
  const pkgPath = resolve(cwd, "package.json")
  const pkgRaw = await readFile(pkgPath, "utf-8")
  const pkg = JSON.parse(pkgRaw) as { version: string; [key: string]: unknown }
  pkg.version = newVersion
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8")

  // 2. Generate and prepend changelog
  const date = new Date().toISOString().slice(0, 10)
  const section = generateChangelog(classified, {
    version: newVersion,
    repoUrl,
    date,
  })
  const changelogPath = resolve(cwd, "CHANGELOG.md")
  let changelogContent = ""
  try {
    changelogContent = await readFile(changelogPath, "utf-8")
  } catch {
    changelogContent = "# Changelog\n\n"
  }
  await writeFile(changelogPath, `${section}${changelogContent}`, "utf-8")

  // 3. Commit, tag, push
  const tag = `v${newVersion}`
  await stageAll(cwd)
  await createCommit(`Release ${tag}`, cwd)
  await createTag(tag, cwd)
  await push(options.branch ?? "main", cwd)
  await pushTag(tag, cwd)

  // 4. Create GitHub Release
  await createRelease({
    repo: extractRepo(repoUrl),
    tag,
    notes: section,
    githubToken: options.githubToken,
  })

  console.log(`\n✅ Released ${tag}`)
  console.log(`   ${repoUrl}/releases/tag/${tag}`)
}
