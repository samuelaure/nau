#!/bin/bash
# scripts/deploy/backup-db.sh
# Performs a binary pg_dump snapshot of the database.

# Load environment variables if .env exists locally (for DB_NAME, DB_USER, etc)
# On the server, these might already be in the environment.
[ -f .env ] && export $(grep -v '^#' .env | xargs)

TIMESTAMP=$(date +%Y%m%d%H%M%S)
BACKUP_DIR="./backups"
DB_CONTAINER="shared_postgres"
DB_NAME=${DB_NAME:-whatsnau}
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql"

mkdir -p $BACKUP_DIR

# Check if container exists and is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "⚠️  Container $DB_CONTAINER not found or not running. Skipping backup (likely first deploy)."
    exit 0
fi

echo "📦 Backing up database $DB_NAME from $DB_CONTAINER..."

# Use docker exec to run pg_dump. 
# We ignore errors if the database doesn't exist yet (first deploy)
docker exec $DB_CONTAINER pg_dump -U ${DB_USER:-db_user} $DB_NAME > $BACKUP_FILE 2>last_backup_error.log

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $BACKUP_FILE"
    # Keep only the last 5 backups
    ls -t ${BACKUP_DIR}/${DB_NAME}_*.sql | tail -n +6 | xargs rm -f
    ln -sf "$(basename $BACKUP_FILE)" "${BACKUP_DIR}/${DB_NAME}_latest.sql"
    rm -f last_backup_error.log
else
    # If pg_dump fails, check if it's because the role/database doesn't exist
    if grep -qE "role \".*\" does not exist|database \".*\" does not exist" last_backup_error.log; then
        echo "⚠️  Database or Role not found. Skipping backup (likely first deploy)."
        rm -f $BACKUP_FILE last_backup_error.log
        exit 0
    fi
    echo "❌ Backup failed!"
    cat last_backup_error.log
    exit 1
fi
