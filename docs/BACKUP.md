# Backup and restore

The default Docker stack uses **PostgreSQL** inside the `opengrc` service. Data is stored in the **`pgdata`** volume.

## Logical backup (pg_dump)

With the stack running:

```bash
docker compose exec opengrc bash -c 'PGPASSWORD=grc pg_dump -h 127.0.0.1 -U grc -d grc -F c -f /tmp/grc.dump'
docker compose cp opengrc:/tmp/grc.dump ./grc.dump
```

Restore (example — stop traffic first, then):

```bash
docker compose cp ./grc.dump opengrc:/tmp/grc.dump
docker compose exec opengrc bash -c 'PGPASSWORD=grc pg_restore -h 127.0.0.1 -U grc -d grc --clean --if-exists /tmp/grc.dump'
```

Adjust user/password if you override `POSTGRES_*` in the image (defaults match [Dockerfile](../Dockerfile)).

## Volume snapshot

For infrastructure-level backups, snapshot the Docker volume backing `pgdata` (name is typically prefixed with the project directory, e.g. `compliance-as-code_pgdata`).

## SQLite (local development only)

If you run the API locally with SQLite (`DB_TYPE=sqlite`), copy the file pointed to by `SQLITE_PATH` / `LOCAL_DATA_DIR` instead of using `pg_dump`.

## Evidence files

Object storage may be S3-compatible or local disk depending on `STORAGE_BACKEND`. Back up the bucket or mounted evidence directory according to your deployment.
