# Backup and restore

## SQLite database

```bash
docker compose cp api:/app/local-data/grc.sqlite ./grc.sqlite.backup
```

Restore:

```bash
docker compose cp ./grc.sqlite.backup api:/app/local-data/grc.sqlite
```

## Evidence files

```bash
docker compose cp api:/app/evidence ./evidence-backup
```

Restore:

```bash
docker compose cp ./evidence-backup api:/app/evidence
```

Schedule these jobs with your platform scheduler (cron, task scheduler, etc.).
