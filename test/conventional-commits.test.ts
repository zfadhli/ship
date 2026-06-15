import { describe, expect, it } from "bun:test"
import { classifyBump, classifyCommits } from "../src/core/conventional-commits.ts"

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
