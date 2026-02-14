#!/bin/bash
# scripts/deploy/restore-db.sh
# Restores the database from the 'latest' snapshot.

[ -f .env ] && export $(grep -v '^#' .env | xargs)

BACKUP_DIR="./backups"
# Find the postgres container dynamically
DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "postgres" | head -n 1)
DB_NAME=${DB_NAME:-whatsnau}
LATEST_BACKUP="${BACKUP_DIR}/${DB_NAME}_latest.sql"

if [ ! -f $LATEST_BACKUP ]; then
    echo "❌ No latest backup found at $LATEST_BACKUP!"
    exit 1
fi

echo "⏪ Restoring database $DB_NAME from $LATEST_BACKUP..."

# Drop and recreate database to ensure a clean restore (Optional but safer for schema changes)
# docker exec $DB_CONTAINER dropdb -U ${DB_USER:-db_user} $DB_NAME
# docker exec $DB_CONTAINER createdb -U ${DB_USER:-db_user} $DB_NAME

# Restore
# Using cat and docker exec -i to pipe the SQL file into psql
cat $LATEST_BACKUP | docker exec -i $DB_CONTAINER psql -U ${DB_USER:-db_user} -d $DB_NAME

if [ $? -eq 0 ]; then
    echo "✅ Restore successful."
else
    echo "❌ Restore failed!"
    exit 1
fi
