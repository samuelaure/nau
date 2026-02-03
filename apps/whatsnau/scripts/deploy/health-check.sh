#!/bin/bash
# scripts/deploy/health-check.sh
# Verifies if the application is healthy after deployment.

URL=${1:-"http://localhost:3000/health"}
MAX_RETRIES=10
RETRY_INTERVAL=3

echo "🔍 Checking health at $URL..."

for ((i=1; i<=MAX_RETRIES; i++)); do
    response=$(curl -s -o /dev/null -w "%{http_code}" $URL)
    
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
