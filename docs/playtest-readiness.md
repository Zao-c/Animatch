# Friends Playtest Readiness

## Manual Backup Before Playtest

Run a database backup before inviting friends:

```bash
./scripts/backup-postgres.sh
```

The script reads `.env.production`, uses `docker-compose.prod.yml`, and writes a gzipped dump to `backups/animatch-YYYYmmdd-HHMMSS.sql.gz`.

Do not commit backup files. The `backups/`, `*.sql`, and `*.sql.gz` patterns are ignored by git.

Restore drills should be done in a test environment before a wider playtest.
