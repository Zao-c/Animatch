set -e

# Existing databases keep the normal deploy path. Never auto-bootstrap, db push,
# or resolve migration records here. New databases require an operator-reviewed
# initialization session; see docs/anisong-migration-release.md and
# docs/anisong-final-release.md. A failed deploy must prevent application startup.
pnpm prisma migrate deploy
pnpm start
