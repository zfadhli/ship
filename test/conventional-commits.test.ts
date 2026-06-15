import { describe, expect, it } from "bun:test"
import { classifyBump, classifyCommits, validateCommits } from "../src/core/conventional-commits.ts"

describe("classifyBump", () => {
  it("returns patch for fix commits", () => {
    expect(classifyBump([{ hash: "abc", message: "fix: typo" }])).toBe("patch")
  })

  it("returns patch for chore commits", () => {
    expect(classifyBump([{ hash: "abc", message: "chore: update deps" }])).toBe("patch")
  })

  it("returns minor for feat commits", () => {
    expect(classifyBump([{ hash: "abc", message: "feat: add widget" }])).toBe("minor")
  })

  it("returns minor for feat(scope) commits", () => {
    expect(classifyBump([{ hash: "abc", message: "feat(core): add widget" }])).toBe("minor")
  })

  it("returns major for breaking changes with !", () => {
    expect(classifyBump([{ hash: "abc", message: "feat!: rewrite API" }])).toBe("major")
  })

  it("returns major for BREAKING CHANGE in body", () => {
    expect(classifyBump([{ hash: "abc", message: "feat: x\n\nBREAKING CHANGE: y" }])).toBe("major")
  })

  it("prioritizes major over minor", () => {
    expect(
      classifyBump([
        { hash: "a", message: "feat: add widget" },
        { hash: "b", message: "feat!: breaking change" },
      ]),
    ).toBe("major")
  })

  it("returns patch for empty commits", () => {
    expect(classifyBump([])).toBe("patch")
  })
})

describe("classifyCommits", () => {
  it("classifies feat commits", () => {
    const result = classifyCommits([{ hash: "abc", message: "feat: new thing" }])
    expect(result[0]?.type).toBe("feat")
    expect(result[0]?.body).toBe("new thing")
  })

  it("classifies fix commits", () => {
    const result = classifyCommits([{ hash: "abc", message: "fix: bug" }])
    expect(result[0]?.type).toBe("fix")
  })

  it("classifies breaking commits", () => {
    const result = classifyCommits([{ hash: "abc", message: "feat!: break" }])
    expect(result[0]?.type).toBe("breaking")
  })

  it("classifies other commits", () => {
    const result = classifyCommits([{ hash: "abc", message: "docs: readme" }])
    expect(result[0]?.type).toBe("other")
  })
})

describe("validateCommits", () => {
  it("returns no warnings for valid conventional commits", () => {
    const result = validateCommits([
      { hash: "a", message: "feat: add widget" },
      { hash: "b", message: "fix(core): resolve crash" },
      { hash: "c", message: "chore: update deps" },
    ])
    expect(result).toHaveLength(0)
  })

  it("warns on non-conventional message", () => {
    const result = validateCommits([{ hash: "abc", message: "some random message" }])
    expect(result).toHaveLength(1)
    expect(result[0]?.reason).toContain("conventional commit format")
  })

  it("warns on unrecognized type", () => {
    const result = validateCommits([{ hash: "abc", message: "wip: trying stuff" }])
    expect(result).toHaveLength(1)
    expect(result[0]?.reason).toContain('Unrecognized type "wip"')
  })

  it("skips merge commits", () => {
    const result = validateCommits([{ hash: "abc", message: "Merge branch 'main' into feat/x" }])
    expect(result).toHaveLength(0)
  })

  it("skips release commits", () => {
    const result = validateCommits([{ hash: "abc", message: "Release v1.2.3" }])
    expect(result).toHaveLength(0)
  })

  it("accepts scope with bang", () => {
    const result = validateCommits([{ hash: "abc", message: "feat(core)!: breaking change" }])
    expect(result).toHaveLength(0)
  })

  it("handles mixed valid and invalid commits", () => {
    const result = validateCommits([
      { hash: "a", message: "feat: good" },
      { hash: "b", message: "nonsense" },
      { hash: "c", message: "fix: ok" },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.hash).toBe("b")
  })
})
