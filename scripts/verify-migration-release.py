#!/usr/bin/env python3
"""Disposable PG16 migration rehearsal. Never reads DATABASE_URL or production data."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
INITIAL = '20260608182702_initial_migration'
CUTOFF = '20261029000000_anisongmatch'
name = 'anisong-release-' + uuid.uuid4().hex[:10]
out = Path(tempfile.mkdtemp(prefix='anisong-migration-evidence-'))
print(f'Evidence: {out}', flush=True)
env = dict(os.environ)

def run(args, *, data=None, check=True):
    p = subprocess.run(args, input=data, text=True, capture_output=True, cwd=ROOT, env=env)
    with (out / 'commands.log').open('a') as log:
        # Arguments contain only disposable local connection strings, no inherited secrets.
        log.write('$ ' + ' '.join(map(str, args)) + '\n' + p.stdout + p.stderr + f'\nexit={p.returncode}\n')
    if check and p.returncode:
        raise RuntimeError(f'{args[0:3]} failed; inspect {out}/commands.log')
    return p

def sql(db, text):
    return run(['docker', 'exec', '-i', name, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'audit', '-d', db], data=text).stdout

def prisma(db, *args):
    env['DATABASE_URL'] = f'postgresql://audit:local-audit-only@127.0.0.1:{port}/{db}'
    return run(['pnpm', 'exec', 'prisma', *args])

try:
    run(['docker', 'run', '-d', '--rm', '--name', name, '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_USER=audit', '-e', 'POSTGRES_PASSWORD=local-audit-only', '-p', '127.0.0.1::5432', 'postgres:16'])
    port = run(['docker', 'port', name, '5432/tcp']).stdout.strip().rsplit(':', 1)[1]
    for _ in range(60):
        if run(['docker', 'exec', name, 'pg_isready', '-U', 'audit'], check=False).returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError('Postgres did not become ready')
    for db in ['broken', 'fresh', 'old', 'restored']:
        sql('postgres', f'CREATE DATABASE {db};')
    migrations = sorted((ROOT / 'prisma/migrations').glob('*/migration.sql'))
    checksums = {p.parent.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in migrations}
    (out / 'migration-checksums.json').write_text(json.dumps(checksums, indent=2) + '\n')
    env['DATABASE_URL'] = f'postgresql://audit:local-audit-only@127.0.0.1:{port}/broken'
    failure = run(['pnpm', 'exec', 'prisma', 'migrate', 'deploy'], check=False)
    assert failure.returncode != 0 and 'P3018' in failure.stderr
    # Fresh install: execute exactly the original initial SQL, then stamp only that ID.
    sql('fresh', 'BEGIN;\n' + (ROOT / f'prisma/migrations/{INITIAL}/migration.sql').read_text(encoding='utf-8-sig') + '\nCOMMIT;')
    prisma('fresh', 'migrate', 'resolve', '--applied', INITIAL)
    prisma('fresh', 'migrate', 'deploy')
    prisma('fresh', 'migrate', 'status')
    prisma('fresh', 'migrate', 'deploy')
    # Restore a synthetic pre-library database + real Prisma-format ledger.
    for p in [ROOT / f'prisma/migrations/{INITIAL}/migration.sql'] + [p for p in migrations if p.parent.name != INITIAL and p.parent.name <= CUTOFF]:
        sql('old', 'BEGIN;\n' + p.read_text(encoding='utf-8-sig') + '\nCOMMIT;')
        prisma('old', 'migrate', 'resolve', '--applied', p.parent.name)
    fixture = json.loads((ROOT / 'docs/validation/anisong-synthetic-v1.json').read_text())
    doc = json.dumps(fixture['document']).replace("'", "''")
    snapshot = json.dumps(fixture['snapshot']).replace("'", "''")
    sql('old', f'''INSERT INTO "User" (id, "updatedAt") VALUES ('release-sentinel', CURRENT_TIMESTAMP);
INSERT INTO "SongBoard" (id, "ownerId", title, document, "shareToken", snapshot, "updatedAt") VALUES ('legacy-sentinel', 'release-sentinel', 'Isolated synthetic legacy record', '{doc}', 'legacy-sentinel-share', '{snapshot}', CURRENT_TIMESTAMP);''')
    query = 'SELECT id, document::text, "shareToken", snapshot::text FROM "SongBoard" WHERE id=\'legacy-sentinel\';'
    before = sql('old', query)
    dump = run(['docker', 'exec', name, 'pg_dump', '-U', 'audit', '-d', 'old', '--no-owner', '--no-privileges']).stdout
    (out / 'synthetic-pre-library.sql').write_text(dump)
    sql('restored', dump)
    prisma('restored', 'migrate', 'deploy')
    prisma('restored', 'migrate', 'status')
    prisma('restored', 'migrate', 'deploy')
    sentinel = sql('restored', query)
    assert sentinel == before
    assert 'legacy-sentinel-share' in sentinel and '"version": 1' in sentinel
    (out / 'restored-sentinel.txt').write_text(sentinel)
    urls = {db: f'postgresql://audit:local-audit-only@127.0.0.1:{port}/{db}' for db in ['fresh', 'restored']}
    diff = prisma('fresh', 'migrate', 'diff', '--from-url', urls['fresh'], '--to-url', urls['restored'], '--exit-code')
    (out / 'fresh-vs-restored.txt').write_text(diff.stdout)
    env['DATABASE_URL'] = urls['fresh']
    schema_diff = run(['pnpm', 'exec', 'prisma', 'migrate', 'diff', '--from-url', urls['fresh'], '--to-schema-datamodel', 'prisma/schema.prisma', '--script'])
    (out / 'schema-drift.sql').write_text(schema_diff.stdout)
    for db in ['fresh', 'restored']:
        catalog = sql(db, '''SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2;
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2;''')
        (out / f'{db}-catalog.txt').write_text(catalog)
    assert (out / 'fresh-catalog.txt').read_text() == (out / 'restored-catalog.txt').read_text()
    print('PASS: failure reproduced; fresh install; status; repeat deploy; dump/restore upgrade; data preservation; catalog equality.', flush=True)
    print('Schema drift recorded separately; inspect schema-drift.sql.', flush=True)
finally:
    run(['docker', 'stop', name], check=False)
