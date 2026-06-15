/** @internal Error hierarchy for predictable error handling */

export class ShipError extends Error {
  override name = "ShipError"
}

export class DirtyWorktreeError extends ShipError {
  override name = "DirtyWorktreeError"
  constructor() {
    super("Working tree is dirty — commit or stash first")
  }
}

export class NotAuthenticatedError extends ShipError {
  override name = "NotAuthenticatedError"
  constructor() {
    super("Not authenticated with GitHub CLI. Run `gh auth login`")
  }
}

export class NoCommitsError extends ShipError {
  override name = "NoCommitsError"
  constructor(since: string) {
    super(`No commits since ${since} — nothing to release`)
  }
}
