#!/bin/bash
# scripts/deploy/health-check.sh
# Verifies if the application is healthy after deployment.

URL=${1:-"http://localhost:3000/health"}
CONTAINER_NAME=$2
MAX_RETRIES=10
RETRY_INTERVAL=3

echo "🔍 Checking health at $URL..."
[ ! -z "$CONTAINER_NAME" ] && echo "📦 Directing check through container: $CONTAINER_NAME"

for ((i=1; i<=MAX_RETRIES; i++)); do
    if [ ! -z "$CONTAINER_NAME" ]; then
        # Check if container is running before trying exec
        STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null)
        if [ "$STATUS" != "running" ]; then
            echo "⏳ Attempt $i/$MAX_RETRIES: Container $CONTAINER_NAME is $STATUS, waiting..."
        else
            # Run curl inside the container to reach localhost:3000
            response=$(docker exec "$CONTAINER_NAME" curl -s -o /dev/null -w "%{http_code}" $URL)
        fi
    else
        # Standard local curl
        response=$(curl -s -o /dev/null -w "%{http_code}" $URL)
    fi
    
    if [ "$response" == "200" ]; then
        echo "✅ Health check passed! (Received HTTP 200)"
        exit 0
    else
        echo "⏳ Attempt $i/$MAX_RETRIES: Received HTTP $response, retrying in ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    fi
done

echo "❌ Health check failed after $MAX_RETRIES attempts!"
exit 1
