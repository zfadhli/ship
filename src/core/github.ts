import { execSync } from "node:child_process"
import { NotAuthenticatedError, ShipError } from "./internal/errors.ts"

function getToken(options?: { githubToken?: string }): string | undefined {
  return options?.githubToken ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
}

/**
 * Verify that we can authenticate with GitHub.
 *
 * If a token is available (via option or env var), it's verified by
 * hitting the GitHub API. Otherwise, falls back to `gh auth status`.
 *
 * Throws {@link NotAuthenticatedError} if neither works.
 */
export async function checkAuth(options?: { githubToken?: string; repo?: string }): Promise<void> {
  const token = getToken(options)

  if (token) {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "ship",
        Accept: "application/vnd.github.v3+json",
      },
    })
    if (res.ok) return
    throw new NotAuthenticatedError()
  }

  // Fall back to gh CLI
  try {
    execSync("gh auth status", { stdio: "pipe", encoding: "utf-8" })
  } catch {
    throw new NotAuthenticatedError()
  }
}

/**
 * Create a GitHub Release for the given tag.
 *
 * If a token is available, posts to the GitHub API directly.
 * Otherwise, falls back to `gh release create`.
 */
export async function createRelease(options: {
  repo: string
  tag: string
  notes: string
  githubToken?: string
}): Promise<void> {
  const token = getToken(options)

  if (token) {
    const res = await fetch(`https://api.github.com/repos/${options.repo}/releases`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "ship",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        tag_name: options.tag,
        name: options.tag,
        body: options.notes,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new ShipError(
        `GitHub API error (${res.status}): ${res.statusText}${text ? `\n${text}` : ""}`,
      )
    }
    return
  }

  // Fall back to gh CLI
  execSync(`gh release create ${options.tag} --notes-file /dev/stdin`, {
    input: options.notes,
    encoding: "utf-8",
  })
}

/**
 * Extract "owner/repo" from a GitHub URL like "https://github.com/owner/repo".
 */
export function extractRepo(repoUrl: string): string {
  return repoUrl.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "")
}
