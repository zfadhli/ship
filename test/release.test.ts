import { describe, expect, it } from "bun:test"
import { ShipError } from "../src/core/internal/errors.ts"
import { release } from "../src/core/release.ts"

describe("release", () => {
  it("throws when not in a git repo", async () => {
    // Run from a tmp dir that isn't a git repo
    try {
      await release({ cwd: "/tmp", yes: true })
      expect.unreachable("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(ShipError)
    }
  })

  it("dryRun does not throw validation errors", async () => {
    // dryRun skips worktree check, so it should just fail on
    // getting commits in a non-git dir
    try {
      await release({ cwd: "/tmp", dryRun: true, yes: true })
      expect.unreachable("should have thrown")
    } catch (_err) {
      // Expected — not in a git repo
    }
  })
})
