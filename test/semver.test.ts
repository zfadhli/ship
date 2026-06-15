import { describe, expect, it } from "bun:test"
import { bumpVersion, parseVersion } from "../src/core/semver.ts"

describe("parseVersion", () => {
  it("parses full semver", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 })
  })

  it("strips v prefix", () => {
    expect(parseVersion("v2.0.0")).toEqual({ major: 2, minor: 0, patch: 0 })
  })

  it("handles 0.0.0", () => {
    expect(parseVersion("0.0.0")).toEqual({ major: 0, minor: 0, patch: 0 })
  })

  it("handles single digit", () => {
    expect(parseVersion("3")).toEqual({ major: 3, minor: 0, patch: 0 })
  })
})

describe("bumpVersion", () => {
  it("bumps major", () => {
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0")
  })

  it("bumps minor", () => {
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0")
  })

  it("bumps patch", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4")
  })

  it("bumps from 0.0.0", () => {
    expect(bumpVersion("0.0.0", "major")).toBe("1.0.0")
    expect(bumpVersion("0.0.0", "minor")).toBe("0.1.0")
    expect(bumpVersion("0.0.0", "patch")).toBe("0.0.1")
  })

  it("accepts SemVer object", () => {
    expect(bumpVersion({ major: 1, minor: 0, patch: 0 }, "minor")).toBe("1.1.0")
  })
})
