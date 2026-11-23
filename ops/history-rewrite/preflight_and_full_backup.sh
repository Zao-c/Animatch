#!/usr/bin/env bash
# AniMatch pre-rewrite backup + preflight. READ-ONLY toward GitHub.
# Usage: bash preflight_and_full_backup.sh [backup-output-directory]
# Creates a local mirror plus a verified git bundle; makes no remote changes.
set -Eeuo pipefail
umask 077
REPO_URL='https://github.com/Zao-c/Animatch.git'
EXPECTED_MAIN='68aee4df118acb8d4c3e97966f05d5f70a23c33c'
EXPECTED_PREVIEW='3e26bf2746908b2b5b75270a8252c8040c93491a'
BACKUP_REF='refs/heads/backup/main-full-history-20261123'
PREVIEW_REF='refs/heads/preview/main-release-milestones-20261123'
OUTPUT_DIR="${1:-$PWD/animatch-history-backup-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR=$(cd "$OUTPUT_DIR" && pwd -P)
echo "[1/7] Clone all Git references into an independent mirror"
git clone --mirror "$REPO_URL" "$OUTPUT_DIR/Animatch.git"
cd "$OUTPUT_DIR/Animatch.git"
echo "[2/7] Validate exact original SHA and historical backup"
MAIN_SHA=$(git rev-parse refs/heads/main)
BACKUP_SHA=$(git rev-parse "$BACKUP_REF")
PREVIEW_SHA=$(git rev-parse "$PREVIEW_REF")
printf 'main:    %s\nbackup:  %s\npreview: %s\n' "$MAIN_SHA" "$BACKUP_SHA" "$PREVIEW_SHA"
[[ "$MAIN_SHA" == "$EXPECTED_MAIN" ]] || { echo 'main changed: replan required' >&2; exit 1; }
[[ "$BACKUP_SHA" == "$EXPECTED_MAIN" ]] || { echo 'backup branch differs from original main' >&2; exit 1; }
[[ "$PREVIEW_SHA" == "$EXPECTED_PREVIEW" ]] || { echo 'preview changed: revalidate milestones' >&2; exit 1; }
echo "[3/7] Verify byte-identical tracked content via Git tree IDs"
MAIN_TREE=$(git rev-parse 'refs/heads/main^{tree}')
PREVIEW_TREE=$(git rev-parse "$PREVIEW_REF^{tree}")
printf 'main tree:    %s\npreview tree: %s\n' "$MAIN_TREE" "$PREVIEW_TREE"
[[ "$MAIN_TREE" == "$PREVIEW_TREE" ]] || { echo 'tracked contents differ: stop' >&2; exit 1; }
[[ "$(git rev-list --count refs/heads/main)" == '493' ]] || { echo 'original history count changed: stop' >&2; exit 1; }
[[ "$(git rev-list --count "$PREVIEW_REF")" == '8' ]] || { echo 'preview history count changed: stop' >&2; exit 1; }
echo "[4/7] Export complete reachable Git objects from ALL mirror refs"
BUNDLE="$OUTPUT_DIR/Animatch-before-history-rewrite.bundle"
git bundle create "$BUNDLE" --all
[[ -s "$BUNDLE" ]] || { echo 'empty bundle: stop' >&2; exit 1; }
echo "[5/7] Verify that the backup bundle can be consumed"
git bundle verify "$BUNDLE"
echo "[6/7] Record hashes and remote refs for recovery"
sha256sum "$BUNDLE" > "$BUNDLE.sha256"
git show-ref > "$OUTPUT_DIR/all-refs-before-rewrite.txt"
git log --all --format='%H%x09%aI%x09%s' > "$OUTPUT_DIR/all-commits-before-rewrite.tsv"
cat > "$OUTPUT_DIR/README-RESTORE.txt" <<TXT
AniMatch full Git mirror and bundle captured before history rewrite.
Original main: $EXPECTED_MAIN
Preview:       $EXPECTED_PREVIEW
Original tree:  $MAIN_TREE
Check bundle:   git bundle verify Animatch-before-history-rewrite.bundle
Offline clone:  git clone Animatch-before-history-rewrite.bundle restored-Animatch
Restore original Git history (only after explicit owner approval):
  git push --force-with-lease=refs/heads/main:<EXPECTED_NEW_MAIN_SHA> origin $EXPECTED_MAIN:refs/heads/main
Set EXPECTED_NEW_MAIN_SHA to the exact new main commit observed at rollback time.
Full Git bundle backs up Git objects and Git refs. GitHub issues/PR comments/Actions/settings and any LFS objects require separate backups.
TXT
echo "[7/7] Preflight completed. No GitHub ref was modified."
echo "Output: $OUTPUT_DIR"
