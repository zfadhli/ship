import { execSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { generateChangelog } from "./changelog.ts"
import type { ClassifiedCommit } from "./conventional-commits.ts"
import { classifyBump, classifyCommits } from "./conventional-commits.ts"
import {
  checkCleanWorktree,
  checkGhAuth,
  createCommit,
  createTag,
  getCommits,
  getLastTag,
  getRepoUrl,
  push,
  pushTag,
  stageAll,
} from "./git.ts"
import { NoCommitsError, ShipError } from "./internal/errors.ts"
import type { BumpType, ReleaseOptions } from "./internal/types.ts"
import { bumpVersion } from "./semver.ts"

interface ReleaseState {
  lastTag: string
  commits: ClassifiedCommit[]
  bump: BumpType
  oldVersion: string
  newVersion: string
  repoUrl: string
  cwd: string
}

/**
 * Run the full release flow:
 *
 * 1. Validate – gh auth, clean worktree
 * 2. Get commits since last tag
 * 3. Classify commits → determine bump (major / minor / patch)
 * 4. Update `package.json` version
 * 5. Generate changelog section, prepend to `CHANGELOG.md`
 * 6. Commit, tag, push
 * 7. Create GitHub Release
 *
 * Pass `{ yes: true }` to skip prompts (CI mode).
 * Pass `{ dryRun: true }` to preview without making changes.
 */
export async function release(options: ReleaseOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd()

  // 1. Validate
  await checkGhAuth()
  if (!options.dryRun) {
    await checkCleanWorktree(cwd)
  }

  // 2. Get commits
  const lastTag = await getLastTag(cwd)
  const rawCommits = await getCommits({
    from: options.from ?? lastTag,
    cwd,
  })

  if (rawCommits.length === 0) {
    throw new NoCommitsError(options.from ?? lastTag)
  }

  // 3. Classify
  const classified = classifyCommits(rawCommits)
  const bump = classifyBump(rawCommits)

  // 4. Read current version
  const pkgPath = resolve(cwd, "package.json")
  const pkgRaw = await readFile(pkgPath, "utf-8")
  const pkg = JSON.parse(pkgRaw) as { version: string; [key: string]: unknown }
  const oldVersion = pkg.version
  const newVersion = bumpVersion(oldVersion, bump)

  // 5. Get repo URL
  const repoUrl = options.repo ? `https://github.com/${options.repo}` : await getRepoUrl(cwd)

  const state: ReleaseState = {
    lastTag,
    commits: classified,
    bump,
    oldVersion,
    newVersion,
    repoUrl,
    cwd,
  }

  // 6. Preview / confirm
  printPreview(state)

  if (options.dryRun) {
    console.log("\n[Dry run] No changes were made.")
    return
  }

  if (!options.yes) {
    const confirmed = await askConfirm("Proceed with release?")
    if (!confirmed) throw new ShipError("Aborted by user")
  }

  // 7. Update package.json
  pkg.version = newVersion
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8")

  // 8. Generate and prepend changelog
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

  // 9. Commit, tag, push
  const tag = `v${newVersion}`
  await stageAll(cwd)
  await createCommit(`Release ${tag}`, cwd)
  await createTag(tag, cwd)
  await push("main", cwd)
  await pushTag(tag, cwd)

  // 10. Create GitHub Release
  execSync(`gh release create ${tag} --notes-file /dev/stdin`, {
    input: section,
    encoding: "utf-8",
    cwd,
  })

  console.log(`\n✅ Released ${tag}`)
  console.log(`   ${repoUrl}/releases/tag/${tag}`)
}

function printPreview(state: ReleaseState): void {
  console.log(`
────────────────────────────────────────
  Last tag:       ${state.lastTag}
  Commits:        ${state.commits.length}
  Old version:    ${state.oldVersion}
  Next bump:      ${state.bump}
  New version:    ${state.newVersion}
────────────────────────────────────────
`)
}

async function askConfirm(prompt: string): Promise<boolean> {
  const { createInterface } = await import("node:readline")
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  return new Promise<boolean>((resolvePromise) => {
    rl.question(`${prompt} [Y/n] `, (answer) => {
      rl.close()
      resolvePromise(!["n", "N"].includes(answer.trim()))
    })
  })
}
