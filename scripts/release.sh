#!/usr/bin/env bash
set -euo pipefail

# ─── helpers ────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
err()   { echo -e "${RED}✘${NC} $1"; exit 1; }

# ─── checks ─────────────────────────────────────────────────────────────────

command -v gh >/dev/null || err "gh CLI not found"
gh auth status >/dev/null 2>&1 || err "not authenticated with gh"

if [ -n "$(git status --porcelain)" ]; then
  err "working tree is dirty — commit or stash first"
fi

# ─── get last tag ───────────────────────────────────────────────────────────

LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
info "latest tag: $LAST_TAG"

# ─── classify commits ───────────────────────────────────────────────────────

COMMITS=$(git log "$LAST_TAG"..HEAD --oneline --no-decorate 2>/dev/null || git log --oneline --no-decorate)

if [ -z "$COMMITS" ]; then
  err "no commits since $LAST_TAG — nothing to release"
fi

MAJOR=0; MINOR=0; PATCH=0

echo ""
echo "Commits since $LAST_TAG:"
echo "$COMMITS" | while read -r line; do
  msg=$(echo "$line" | sed 's/^[a-f0-9]\{7,40\} //')
  hash=$(echo "$line" | awk '{print $1}')
  echo "  $hash  $msg"
done
echo ""

while read -r line; do
  msg=$(echo "$line" | sed 's/^[a-f0-9]\{7,40\} //')
  if echo "$msg" | grep -qiE 'BREAKING CHANGE|^feat.*!:'; then
    MAJOR=1
  elif echo "$msg" | grep -qiE '^feat(\w|\(|:)'; then
    MINOR=1
  else
    PATCH=1
  fi
done <<< "$COMMITS"

# ─── determine bump ─────────────────────────────────────────────────────────

CURRENT=$(node -p "require('./package.json').version")
IFS='.' read -r MAJOR_V MINOR_V PATCH_V <<< "$CURRENT"

if [ "$MAJOR" = "1" ]; then
  MAJOR_V=$((MAJOR_V + 1)); MINOR_V=0; PATCH_V=0
  BUMP="major"
elif [ "$MINOR" = "1" ]; then
  MINOR_V=$((MINOR_V + 1)); PATCH_V=0
  BUMP="minor"
else
  PATCH_V=$((PATCH_V + 1))
  BUMP="patch"
fi

NEW_VERSION="${MAJOR_V}.${MINOR_V}.${PATCH_V}"
TAG="v${NEW_VERSION}"

echo "────────────────────────────────────────"
echo "  Current version:  $CURRENT"
echo "  Detected bump:    $BUMP"
echo "  New version:      $NEW_VERSION"
echo "────────────────────────────────────────"
echo ""
read -rp "Proceed with release? [Y/n] " REPLY
if [[ "$REPLY" == "n" || "$REPLY" == "N" ]]; then
  err "aborted"
fi

# ─── update package.json ────────────────────────────────────────────────────

node -e "
  const p = require('./package.json');
  p.version = '$NEW_VERSION';
  require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2) + '\n');
"
info "package.json version bumped to $NEW_VERSION"

# ─── update CHANGELOG.md ────────────────────────────────────────────────────

REPO_URL=$(gh repo view --json url --jq '.url' 2>/dev/null || echo "https://github.com/$(git remote get-url origin | sed 's/.*github.com[:\/]//; s/\.git$//')")
DATE=$(date +%Y-%m-%d)

FEATS=""; FIXES=""; OTHER=""
while read -r line; do
  hash=$(echo "$line" | awk '{print $1}')
  msg=$(echo "$line" | sed 's/^[a-f0-9]\{7,40\} //')
  short="${msg%%"${msg#*: }"}"
  if [ -z "$short" ]; then short="$msg"; fi
  body="${msg#*: }"
  line_item="- ${body} ([${hash}](${REPO_URL}/commit/${hash}))"
  if echo "$msg" | grep -qiE '^feat'; then
    FEATS="${FEATS}${line_item}"$'\n'
  elif echo "$msg" | grep -qiE '^fix'; then
    FIXES="${FIXES}${line_item}"$'\n'
  else
    OTHER="${OTHER}${line_item}"$'\n'
  fi
done <<< "$COMMITS"

SECTION="## [${NEW_VERSION}] - ${DATE}"
SECTION="${SECTION}"$'\n'
if [ -n "$FEATS" ]; then
  SECTION="${SECTION}"$'\n'"### Features"$'\n'"${FEATS}"
fi
if [ -n "$FIXES" ]; then
  SECTION="${SECTION}"$'\n'"### Bug Fixes"$'\n'"${FIXES}"
fi
if [ -n "$OTHER" ]; then
  SECTION="${SECTION}"$'\n'"### Other Changes"$'\n'"${OTHER}"
fi
SECTION="${SECTION}"$'\n'

if [ -f CHANGELOG.md ]; then
  EXISTING=$(cat CHANGELOG.md)
  printf '%s\n%s' "$SECTION" "$EXISTING" > CHANGELOG.md
else
  printf '# Changelog\n\n%s' "$SECTION" > CHANGELOG.md
fi
info "CHANGELOG.md updated"

echo ""
echo "────────────────────────────────────────"
echo "  Release preview:"
echo ""
head -20 CHANGELOG.md
echo "────────────────────────────────────────"
echo ""
read -rp "Looks good? Commit and release? [Y/n] " CONFIRM
if [[ "$CONFIRM" == "n" || "$CONFIRM" == "N" ]]; then
  err "aborted"
fi

# ─── commit, tag, push ──────────────────────────────────────────────────────

git add -A
git commit -m "Release ${TAG}" || true
git tag "$TAG"
git push origin main 2>&1 || true
git push origin "$TAG" 2>&1 || true
info "committed and pushed"

# ─── create GitHub Release ──────────────────────────────────────────────────

echo "$SECTION" > "/tmp/release-notes-${TAG}.md"
gh release create "$TAG" --notes-file "/tmp/release-notes-${TAG}.md"
rm -f "/tmp/release-notes-${TAG}.md"

info "GitHub Release created: ${TAG}"
echo ""
echo "Done. Happy releasing! 🎉"
