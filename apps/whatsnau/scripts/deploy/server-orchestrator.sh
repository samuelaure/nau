#!/bin/bash
# scripts/deploy/server-orchestrator.sh
# Main deployment orchestrator on the server.
# Usage: ./server-orchestrator.sh <image_tag>

TAG=$1
if [ -z "$TAG" ]; then
    echo "❌ No image tag provided!"
    exit 1
fi

IMAGE_BASE="ghcr.io/${GITHUB_REPOSITORY_OWNER:-samuelaure}/whatsnau-backend"
IMAGE_FULL="$IMAGE_BASE:$TAG"

# Determine project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Starting Orchestration for version $TAG from $PROJECT_ROOT..."

# 1. Pull the new image
echo "📥 Pulling image: $IMAGE_FULL..."
docker pull $IMAGE_FULL
if [ $? -ne 0 ]; then
    echo "❌ Failed to pull image $IMAGE_FULL"
    exit 1
fi

# 2. Database Backup (Uses shared_postgres if configured in .env)
./scripts/deploy/backup-db.sh
if [ $? -ne 0 ]; then
    echo "❌ Database backup failed. Aborting deployment."
    exit 1
fi

# 3. Tag current image for rollback
CURRENT_IMAGE_ID=$(docker images -q $IMAGE_BASE:latest 2>/dev/null)
if [ ! -z "$CURRENT_IMAGE_ID" ]; then
    echo "💾 Tagging current version for rollback..."
    docker tag $IMAGE_BASE:latest $IMAGE_BASE:rollback_backup
fi

# 4. Infrastructure Setup
echo "⚙️ Setting up infrastructure overrides..."
if [ ! -f "docker-compose.override.yml" ] && [ -f "docker-compose.override.yml.example" ]; then
    echo "📄 Copying docker-compose.override.yml from example..."
    cp docker-compose.override.yml.example docker-compose.override.yml
fi

# Detect docker compose version
DOCKER_COMPOSE_CMD="docker compose"
if ! $DOCKER_COMPOSE_CMD version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
fi
echo "🛠 Using command: $DOCKER_COMPOSE_CMD"

# 5. Update and Restart
echo "🔄 Updating service..."
docker tag $IMAGE_FULL $IMAGE_BASE:latest
$DOCKER_COMPOSE_CMD up -d

# 6. Run Migrations
echo "🏃 Running database migrations..."
MIGRATION_STATUS=1
for i in {1..10}; do
    CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep -E "whatsnau-app-1|app" | head -n 1)
    if [ ! -z "$CONTAINER_NAME" ]; then
        echo "📡 Found container: $CONTAINER_NAME. Running migrations..."
        docker exec $CONTAINER_NAME npx prisma migrate deploy
        MIGRATION_STATUS=$?
        break
    fi
    echo "⏳ Waiting for app container (attempt $i/10)..."
    sleep 3
done

if [ $MIGRATION_STATUS -ne 0 ]; then
    echo "❌ Database migrations failed!"
fi

# 7. Health Check
./scripts/deploy/health-check.sh
HEALTH_STATUS=$?

# 8. Rollback if needed
if [ $MIGRATION_STATUS -ne 0 ] || [ $HEALTH_STATUS -ne 0 ]; then
    echo "🚨 Deployment FAILED! Initiating Rollback..."
    
    if docker image inspect $IMAGE_BASE:rollback_backup >/dev/null 2>&1; then
        echo "⏪ Rolling back to previous image..."
        docker tag $IMAGE_BASE:rollback_backup $IMAGE_BASE:latest
        $DOCKER_COMPOSE_CMD up -d
    fi
    
    ./scripts/deploy/restore-db.sh
    
    echo "🛑 Rollback complete. System restored to previous state."
    exit 1
fi

echo "✨ Deployment of $TAG successful!"
exit 0
