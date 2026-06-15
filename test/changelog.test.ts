import { describe, expect, it } from "bun:test"
import { generateChangelog } from "../src/core/changelog.ts"

describe("generateChangelog", () => {
  it("generates a section with features", () => {
    const result = generateChangelog(
      [
        {
          hash: "abc123def456",
          message: "feat: add cool feature",
          body: "add cool feature",
          type: "feat",
        },
      ],
      {
        version: "1.0.0",
        repoUrl: "https://github.com/user/repo",
        date: "2026-06-15",
      },
    )
    expect(result).toContain("## [1.0.0] - 2026-06-15")
    expect(result).toContain("add cool feature")
    expect(result).toContain("abc123d")
    expect(result).toContain("### Features")
  })

  it("generates a section with bug fixes", () => {
    const result = generateChangelog(
      [
        {
          hash: "def789",
          message: "fix: resolve crash",
          body: "resolve crash",
          type: "fix",
        },
      ],
      {
        version: "1.0.1",
        repoUrl: "https://github.com/user/repo",
        date: "2026-06-15",
      },
    )
    expect(result).toContain("### Bug Fixes")
    expect(result).toContain("resolve crash")
  })

  it("includes other changes section", () => {
    const result = generateChangelog(
      [
        {
          hash: "aaa",
          message: "chore: update deps",
          body: "update deps",
          type: "other",
        },
      ],
      {
        version: "1.0.0",
        repoUrl: "https://github.com/user/repo",
        date: "2026-06-15",
      },
    )
    expect(result).toContain("### Other Changes")
    expect(result).toContain("update deps")
  })

  it("handles empty commits", () => {
    const result = generateChangelog([], {
      version: "1.0.0",
      repoUrl: "https://github.com/user/repo",
      date: "2026-06-15",
    })
    expect(result).toBe("## [1.0.0] - 2026-06-15\n\n")
  })

  it("uses today's date when not provided", () => {
    const today = new Date().toISOString().slice(0, 10)
    const result = generateChangelog(
      [
        {
          hash: "abc",
          message: "fix: x",
          body: "x",
          type: "fix",
        },
      ],
      { version: "1.0.0", repoUrl: "https://github.com/u/r" },
    )
    expect(result).toContain(today)
  })

  it("produces consistent output for mixed commits", () => {
    const result = generateChangelog(
      [
        { hash: "a1", message: "feat: feature one", body: "feature one", type: "feat" },
        { hash: "b2", message: "fix: bug fix", body: "bug fix", type: "fix" },
        { hash: "c3", message: "chore: maintenance", body: "maintenance", type: "other" },
      ],
      {
        version: "2.0.0",
        repoUrl: "https://github.com/user/repo",
        date: "2026-06-15",
      },
    )
    expect(result).toContain("### Features")
    expect(result).toContain("### Bug Fixes")
    expect(result).toContain("### Other Changes")
    expect(result).toContain("feature one")
    expect(result).toContain("bug fix")
    expect(result).toContain("maintenance")
  })
})
