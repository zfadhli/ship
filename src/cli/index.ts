#!/usr/bin/env node
import { color, createCLI } from "@zfadhli/koko-cli"
import { classifyBump, getCommits, getLastTag, release, ShipError } from "../core/index.ts"

const cli = createCLI("ship", "0.1.0").description(
  "Release automation — changelog generation, version bumping, GitHub releases",
)

// ── ship release ───────────────────────────────────────────────────────
cli.command("release", "Run the full release flow", (cmd) => {
  cmd.option("--dry-run", "Preview changes without making them")
  cmd.option("--yes, -y", "Skip all confirmation prompts (CI mode)")
  cmd.option("--from <ref>", "Git ref to compare against (default: last tag)")
  cmd.option("--repo <owner/repo>", "GitHub repository override")

  cmd.action(
    async (options: { dryRun?: boolean; yes?: boolean; from?: string; repo?: string }, ctx) => {
      const spin = ctx.spinner("Analyzing commits...")
      spin.start()
      try {
        await release({
          dryRun: options.dryRun ?? false,
          yes: options.yes ?? false,
          from: options.from,
          repo: options.repo,
        })
        spin.stop()
        console.log(color.green("  Release complete!"))
      } catch (err) {
        if (err instanceof ShipError) {
          spin.fail(color.red(err.message))
        } else {
          spin.fail(color.red(String(err)))
        }
        process.exit(1)
      }
    },
  )
})

// ── ship status ────────────────────────────────────────────────────────
cli.command("status", "Show what the next release would look like", (cmd) => {
  cmd.option("--repo <owner/repo>", "GitHub repository")

  cmd.action(async (_options: { dryRun?: boolean }, ctx) => {
    const spin = ctx.spinner("Checking...")
    spin.start()
    try {
      const from = await getLastTag()
      const commits = await getCommits({ from })
      const bump = classifyBump(commits)
      spin.stop()
      console.log(`Last tag:  ${from}`)
      console.log(`Commits:   ${commits.length}`)
      console.log(`Next bump: ${bump}`)
    } catch (err) {
      spin.fail(color.red(String(err)))
      process.exit(1)
    }
  })
})

cli.parse()
