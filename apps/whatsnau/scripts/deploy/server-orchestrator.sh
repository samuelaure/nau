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
# (De-sentinel: Overrides removed. Relying on Clean Docker Compose)

# Detect docker compose version
DOCKER_COMPOSE_CMD="docker compose"
if ! $DOCKER_COMPOSE_CMD version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
fi
echo "🛠 Using command: $DOCKER_COMPOSE_CMD"

# 5. Update and Restart
echo "🔄 Updating service..."
docker tag $IMAGE_FULL $IMAGE_BASE:latest
$DOCKER_COMPOSE_CMD up -d --remove-orphans

# 6. Run Migrations
echo "🏃 Running database migrations..."
MIGRATION_STATUS=1
CONTAINER_NAME=""

for i in {1..10}; do
    # 1. Look for the service container (standard compose naming)
    # Matches whatsnau-app-1, whatsnau_app_1, or just whatsnau-app
    CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep -E "whatsnau[-_]app" | head -n 1)
    
    if [ ! -z "$CONTAINER_NAME" ]; then
        # Check if the container is actually running, restarting, or exited
        STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null)
        
        if [ "$STATUS" == "running" ]; then
            echo "📡 Found running container: $CONTAINER_NAME. Attempting migrations..."
            
            # Retry migration up to 3 times inside the running container
            for attempt in {1..3}; do
                docker exec "$CONTAINER_NAME" npx prisma migrate deploy > migration_output.log 2>&1
                MIGRATION_STATUS=$?
                
                if [ $MIGRATION_STATUS -eq 0 ]; then
                    echo "✅ Migrations applied successfully."
                    rm migration_output.log
                    break 2
                else
                    echo "⚠️ Migration attempt $attempt failed. Status: $MIGRATION_STATUS"
                    echo "📝 Migration Logs:"
                    cat migration_output.log
                    if [ $attempt -lt 3 ]; then
                        echo "⏳ Retrying migration in 5 seconds..."
                        sleep 5
                    fi
                fi
            done
            break # Exit the container-wait loop
        elif [ "$STATUS" == "restarting" ]; then
            echo "🚨 Container $CONTAINER_NAME is in a RESTART LOOP! This usually indicates a crash on startup (e.g. missing env vars)."
            echo "📝 Container logs (last 50 lines):"
            docker logs --tail 50 "$CONTAINER_NAME"
            break # Fail fast if it's already in a restart loop
        fi
    else
        # Diagnostic: Check for crashed containers if not found running
        CRASHED_CONTAINER=$(docker ps -a --format '{{.Names}}' | grep -E "^whatsnau$" | head -n 1)
        if [ ! -z "$CRASHED_CONTAINER" ]; then
            STATE=$(docker inspect -f '{{.State.Status}}' "$CRASHED_CONTAINER")
            if [ "$STATE" == "exited" ]; then
                echo "🚨 Container $CRASHED_CONTAINER crashed! Status: $STATE"
                echo "📝 last 20 lines of logs:"
                docker logs --tail 20 "$CRASHED_CONTAINER"
                break
            fi
        fi
    fi
    echo "⏳ Waiting for app container to stabilize (attempt $i/10)..."
    sleep 3
done

if [ $MIGRATION_STATUS -ne 0 ]; then
    echo "❌ Database migrations failed permanently!"
    echo "📝 Checking final container logs before rollback:"
    [ ! -z "$CONTAINER_NAME" ] && docker logs --tail 50 "$CONTAINER_NAME"
fi

# 7. Health Check (Pass container name for internal check)
./scripts/deploy/health-check.sh "http://localhost:3000/health" "$CONTAINER_NAME"
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
