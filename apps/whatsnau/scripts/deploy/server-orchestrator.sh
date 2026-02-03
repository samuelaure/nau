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

# 4. Update and Restart
echo "🔄 Updating service..."
# Update the .env or use environment variables to point to the new tag
# If using a docker-compose.yml that uses 'image: ...:latest', 
# we need to retag the new image as latest.
docker tag $IMAGE_FULL $IMAGE_BASE:latest

docker-compose up -d whatsnau

# 5. Run Migrations
echo "🏃 Running database migrations..."
# Assuming prisma is in the backend package and we use the backend container
docker exec $CONTAINER_NAME npx prisma migrate deploy
MIGRATION_STATUS=$?

# 6. Health Check
./health-check.sh
HEALTH_STATUS=$?

# 7. Rollback if needed
if [ $MIGRATION_STATUS -ne 0 ] || [ $HEALTH_STATUS -ne 0 ]; then
    echo "🚨 Deployment FAILED! Initiating Rollback..."
    
    # Revert image
    if docker image inspect $IMAGE_BASE:rollback_backup >/dev/null 2>&1; then
        docker tag $IMAGE_BASE:rollback_backup $IMAGE_BASE:latest
        docker-compose up -d whatsnau
    fi
    
    # Restore DB
    ./restore-db.sh
    
    echo "🛑 Rollback complete. System restored to previous state."
    exit 1
fi

echo "✨ Deployment of $TAG successful!"
exit 0
