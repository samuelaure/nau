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

echo "📦 Backing up database $DB_NAME from $DB_CONTAINER..."

# Use docker exec to run pg_dump. 
# We assume the user running this has permission to run docker.
docker exec $DB_CONTAINER pg_dump -U ${DB_USER:-db_user} $DB_NAME > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $BACKUP_FILE"
    # Keep only the last 5 backups to save space
    ls -t ${BACKUP_DIR}/${DB_NAME}_*.sql | tail -n +6 | xargs rm -f
    # Create a 'latest' symlink for easy rollback context
    ln -sf "$(basename $BACKUP_FILE)" "${BACKUP_DIR}/${DB_NAME}_latest.sql"
else
    echo "❌ Backup failed!"
    exit 1
fi
