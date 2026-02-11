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
if [ -f "docker-compose.override.yml.example" ]; then
    echo "📄 Forced sync: Updating docker-compose.override.yml from example..."
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
$DOCKER_COMPOSE_CMD up -d --remove-orphans

# 6. Run Migrations
echo "🏃 Running database migrations..."
MIGRATION_STATUS=1
CONTAINER_NAME=""

for i in {1..10}; do
    # 1. Look for the exact container name specified in the override
    CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep -E "^whatsnau$" | head -n 1)
    
    # 2. Fallback to default compose pattern (project-service-index)
    if [ -z "$CONTAINER_NAME" ]; then
        CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep -E "whatsnau-app-1" | head -n 1)
    fi
    
    if [ ! -z "$CONTAINER_NAME" ]; then
        # Check if the container is actually running and not restarting
        IS_RUNNING=$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null)
        if [ "$IS_RUNNING" == "true" ]; then
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
                    echo "⚠️ Migration attempt $attempt failed. Logs:"
                    cat migration_output.log
                    if [ $attempt -lt 3 ]; then
                        echo "⏳ Retrying migration in 5 seconds..."
                        sleep 5
                    fi
                fi
            done
            break # Exit the container-wait loop if we finished (success or final failure)
        fi
    else
        # Diagnostic: Check for crashed containers if not found running
        CRASHED_CONTAINER=$(docker ps -a --format '{{.Names}}' | grep -E "^whatsnau$" | head -n 1)
        if [ ! -z "$CRASHED_CONTAINER" ]; then
            STATE=$(docker inspect -f '{{.State.Status}}' "$CRASHED_CONTAINER")
            if [ "$STATE" == "exited" ]; then
                echo "🚨 Container $CRASHED_CONTAINER crashed! Status: $STATE"
                echo "📝 Last 20 lines of logs:"
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
