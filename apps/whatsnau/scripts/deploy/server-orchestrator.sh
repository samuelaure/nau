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
CONTAINER_NAME="whatsnau"

echo "🚀 Starting Orchestration for version $TAG..."

# 1. Pull the new image first (to minimize downtime later)
echo "📥 Pulling image: $IMAGE_FULL..."
docker pull $IMAGE_FULL
if [ $? -ne 0 ]; then
    echo "❌ Failed to pull image $IMAGE_FULL"
    exit 1
fi

# 2. Database Backup
./backup-db.sh
if [ $? -ne 0 ]; then
    echo "❌ Database backup failed. Aborting deployment."
    exit 1
fi

# 3. Tag current image for rollback
# We assume the service is named 'whatsnau' in docker-compose
CURRENT_IMAGE_ID=$(docker images -q $IMAGE_BASE:latest 2>/dev/null)
if [ ! -z "$CURRENT_IMAGE_ID" ]; then
    echo "💾 Tagging current version for rollback..."
    docker tag $IMAGE_BASE:latest $IMAGE_BASE:rollback_backup
fi

# 4. Infrastructure Cleanup & Setup
echo "🧹 Cleaning up stray containers..."
# Remove containers that should be provided by shared infrastructure
STRAY_CONTAINERS=("whatsnau-redis-1" "whatsnau-postgres-1" "whatsnau-redis" "whatsnau-postgres")
for container in "${STRAY_CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "🛑 Removing stray container: $container"
        docker stop $container >/dev/null 2>&1
        docker rm -f $container >/dev/null 2>&1
    fi
done

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

# Update the .env or use environment variables to point to the new tag
# If using a docker-compose.yml that uses 'image: ...:latest', 
# we need to retag the new image as latest.
docker tag $IMAGE_FULL $IMAGE_BASE:latest

# In docker-compose.yml, the service is named 'app'
$DOCKER_COMPOSE_CMD up -d app
$DOCKER_COMPOSE_CMD up -d worker


# 6. Run Migrations
echo "🏃 Running database migrations..."
# The container name might be different depending on project name, but 'docker-compose up' 
# usually names it <folder>-<service>-1. Let's try to find it.
CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep -E "whatsnau-app-1|app" | head -n 1)
if [ -z "$CONTAINER_NAME" ]; then
    echo "❌ Could not find running app container!"
    MIGRATION_STATUS=1
else
    echo "📡 Found container: $CONTAINER_NAME"
    docker exec $CONTAINER_NAME npx prisma migrate deploy
    MIGRATION_STATUS=$?
fi

# 7. Health Check
./health-check.sh
HEALTH_STATUS=$?

# 8. Rollback if needed
if [ $MIGRATION_STATUS -ne 0 ] || [ $HEALTH_STATUS -ne 0 ]; then

    echo "🚨 Deployment FAILED! Initiating Rollback..."
    
    # Revert image
    if docker image inspect $IMAGE_BASE:rollback_backup >/dev/null 2>&1; then
        docker tag $IMAGE_BASE:rollback_backup $IMAGE_BASE:latest
        $DOCKER_COMPOSE_CMD up -d app
        $DOCKER_COMPOSE_CMD up -d worker
    fi

    
    # Restore DB
    ./restore-db.sh
    
    echo "🛑 Rollback complete. System restored to previous state."
    exit 1
fi

echo "✨ Deployment of $TAG successful!"
exit 0
