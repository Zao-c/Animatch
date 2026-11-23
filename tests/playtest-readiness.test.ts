import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("friends playtest readiness files", () => {
  it("keeps a production backup script and playtest note in the repository", () => {
    const script = readFileSync("scripts/backup-postgres.sh", "utf8");
    const doc = readFileSync("docs/playtest-readiness.md", "utf8");

    expect(existsSync("scripts/backup-postgres.sh")).toBe(true);
    expect(script).toContain("docker compose --env-file");
    expect(script).toContain("pg_dump");
    expect(script).toContain("gzip -c");
    expect(script).toContain('BACKUP_DIR="${BACKUP_DIR:-backups}"');
    expect(script).toContain('output_path="$BACKUP_DIR/animatch-${timestamp}.sql.gz"');
    expect(doc).toContain("./scripts/backup-postgres.sh");
    expect(doc).toContain("Do not commit backup files");
  });

  it("ignores backup outputs and raw SQL dumps", () => {
    const gitignore = readFileSync(".gitignore", "utf8");

    expect(gitignore).toContain("backups/");
    expect(gitignore).toContain("*.sql");
    expect(gitignore).toContain("*.sql.gz");
  });
});
