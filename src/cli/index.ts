#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import * as p from "@clack/prompts"
import { createCLI } from "@zfadhli/koko-cli"
import {
  bumpVersion,
  classifyBump,
  getCommits,
  getLastTag,
  getRepoUrl,
  release,
  ShipError,
} from "../core/index.ts"

const cli = createCLI("ship", "0.1.0").description(
  "Release automation — changelog generation, version bumping, GitHub releases",
)

// ── ship release ───────────────────────────────────────────────────────
cli.command("release", "Run the full release flow", (cmd) => {
  cmd.option("--dry-run", "Preview changes without making them")
  cmd.option("--yes, -y", "Skip all confirmation prompts (CI mode)")
  cmd.option("--from <ref>", "Git ref to compare against (default: last tag)")
  cmd.option("--repo <owner/repo>", "GitHub repository override")
  cmd.option("--branch <name>", "Git branch to push to (default: main)")

  cmd.action(
    async (options: {
      dryRun?: boolean
      yes?: boolean
      from?: string
      repo?: string
      branch?: string
    }) => {
      p.intro("ship release")

      const s = p.spinner()
      s.start("Analyzing commits...")

      try {
        // ── analysis phase ──────────────────────────────────────
        const from = options.from ?? (await getLastTag())
        const commits = await getCommits({ from })

        if (commits.length === 0) {
          s.stop("Nothing to release")
          p.cancel("No commits since the last tag.")
          process.exit(0)
        }

        const bump = classifyBump(commits)
        const pkgRaw = await readFile(resolve("package.json"), "utf-8")
        const oldVersion = (JSON.parse(pkgRaw) as { version: string }).version
        const newVersion = bumpVersion(oldVersion, bump)
        const repoUrl = options.repo ? `https://github.com/${options.repo}` : await getRepoUrl()

        s.stop("Analysis complete")

        // ── preview ─────────────────────────────────────────────
        const previewLines = [
          `Last tag:    ${from}`,
          `Commits:     ${commits.length}`,
          `Old version: ${oldVersion}`,
          `Next bump:   ${bump}`,
          `New version: ${newVersion}`,
        ]

        p.note(previewLines.join("\n"), "Release Preview")

        if (options.dryRun) {
          p.outro("Dry run — no changes were made.")
          return
        }

        // ── confirmation ────────────────────────────────────────
        if (!options.yes) {
          const shouldProceed = await p.confirm({
            message: "Proceed with release?",
            initialValue: true,
          })
          if (p.isCancel(shouldProceed) || !shouldProceed) {
            p.cancel("Aborted")
            process.exit(0)
          }
        }

        // ── execution ───────────────────────────────────────────
        const s2 = p.spinner()
        s2.start("Releasing...")

        await release({
          yes: true,
          dryRun: false,
          from: options.from,
          repo: options.repo,
          branch: options.branch,
        })

        s2.stop(`Released v${newVersion}`)
        p.outro(`Done — ${repoUrl}/releases/tag/v${newVersion}`)
      } catch (err) {
        s.stop("Error")
        if (err instanceof ShipError) {
          p.cancel(err.message)
        } else {
          p.cancel(String(err))
        }
        process.exit(1)
      }
    },
  )
})

// ── ship status ────────────────────────────────────────────────────────
cli.command("status", "Show what the next release would look like", (cmd) => {
  cmd.option("--repo <owner/repo>", "GitHub repository")

  cmd.action(async (_options: { dryRun?: boolean }) => {
    p.intro("ship status")

    const s = p.spinner()
    s.start("Checking...")

    try {
      const from = await getLastTag()
      const commits = await getCommits({ from })
      const bump = classifyBump(commits)

      s.stop("Checked")

      const lines = [`Last tag:  ${from}`, `Commits:   ${commits.length}`, `Next bump: ${bump}`]

      p.note(lines.join("\n"), "Status")
      p.outro("Run `ship release` to release the next version.")
    } catch (err) {
      s.stop("Error")
      if (err instanceof ShipError) {
        p.cancel(err.message)
      } else {
        p.cancel(String(err))
      }
      process.exit(1)
    }
  })
})

cli.parse()
