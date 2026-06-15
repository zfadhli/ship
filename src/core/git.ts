import { execSync } from "node:child_process"
import { DirtyWorktreeError, NotAuthenticatedError, ShipError } from "./internal/errors.ts"
import type { Commit } from "./internal/types.ts"

function exec(cmd: string, cwd?: string): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8" }).trim()
  } catch (err) {
    throw new ShipError(`Command failed: ${cmd}\n${(err as Error).message}`)
  }
}

/**
 * Get the latest git tag reachable from HEAD.
 * Returns "v0.0.0" if no tags exist.
 */
export async function getLastTag(cwd?: string): Promise<string> {
  try {
    return exec("git describe --tags --abbrev=0", cwd)
  } catch {
    return "v0.0.0"
  }
}

/**
 * Get the list of commits since a given git ref.
 * If `from` is omitted, uses the latest tag.
 */
export async function getCommits(opts: { from?: string; cwd?: string } = {}): Promise<Commit[]> {
  const from = opts.from ?? (await getLastTag(opts.cwd))
  let raw: string
  try {
    raw = exec(`git log ${from}..HEAD --oneline --no-decorate`, opts.cwd)
  } catch {
    raw = exec("git log --oneline --no-decorate", opts.cwd)
  }
  if (!raw) return []
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => ({
      hash: line.split(" ")[0] ?? line,
      message: line.slice(line.indexOf(" ") + 1),
    }))
}

/**
 * Check that the working tree is clean. Throws DirtyWorktreeError if not.
 */
export async function checkCleanWorktree(cwd?: string): Promise<void> {
  const status = exec("git status --porcelain", cwd)
  if (status) throw new DirtyWorktreeError()
}

/**
 * Check that `gh` CLI is authenticated. Throws NotAuthenticatedError if not.
 */
export async function checkGhAuth(): Promise<void> {
  try {
    execSync("gh auth status", { stdio: "pipe", encoding: "utf-8" })
  } catch {
    throw new NotAuthenticatedError()
  }
}

/**
 * Get the GitHub repository URL (for changelog links).
 * Tries `gh repo view` first, falls back to git remote.
 */
export async function getRepoUrl(cwd?: string): Promise<string> {
  try {
    const url = exec("gh repo view --json url --jq '.url'", cwd)
    if (url) return url
  } catch {
    // fall through
  }
  const remote = exec("git remote get-url origin", cwd)
  return remote.replace(/.*github.com[:/]/, "https://github.com/").replace(/\.git$/, "")
}

/** Stage all changes via `git add -A`. */
export async function stageAll(cwd?: string): Promise<void> {
  exec("git add -A", cwd)
}

/** Create a git commit. */
export async function createCommit(message: string, cwd?: string): Promise<void> {
  const escaped = message.replace(/"/g, '\\"')
  exec(`git commit -m "${escaped}"`, cwd)
}

/** Create an annotated git tag. */
export async function createTag(tag: string, cwd?: string): Promise<void> {
  exec(`git tag ${tag}`, cwd)
}

/** Push the given branch to origin. */
export async function push(branch = "main", cwd?: string): Promise<void> {
  exec(`git push origin ${branch}`, cwd)
}

/** Push a tag to origin. */
export async function pushTag(tag: string, cwd?: string): Promise<void> {
  exec(`git push origin ${tag}`, cwd)
}
