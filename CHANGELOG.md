## [0.3.0] - 2026-06-15

### Features

- add GitHub API fallback via GITHUB_TOKEN, remove hard gh CLI dependency ([9eb9bed](https://github.com/zfadhli/ship/commit/9eb9bed))
- validate commits against conventional commit format, warn on non-conventional ([d5a17a7](https://github.com/zfadhli/ship/commit/d5a17a7))
- add --branch option for custom branch names ([60b8b7b](https://github.com/zfadhli/ship/commit/60b8b7b))

### Bug Fixes

- preserve prerelease suffix in semver parsing and bumping ([f72ded6](https://github.com/zfadhli/ship/commit/f72ded6))

### Other Changes

- extract preview() from release(), remove I/O from core ([1515b0f](https://github.com/zfadhli/ship/commit/1515b0f))

## [0.2.0] - 2026-06-15

### Features

- replace koko-cli spinner with @clack/prompts for reliable terminal I/O ([073d407](https://github.com/zfadhli/ship/commit/073d407))

### Bug Fixes

- suppress stderr noise from git commands on fresh repos ([7d84fd0](https://github.com/zfadhli/ship/commit/7d84fd0))

### Other Changes

- initial commit ([b79752d](https://github.com/zfadhli/ship/commit/b79752d))

# Changelog

