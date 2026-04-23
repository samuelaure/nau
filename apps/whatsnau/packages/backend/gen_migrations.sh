#!/bin/bash
# Copy env files and generate migrations on server
for repo in 9nau nauthenticity flownau whatsnau zazu; do
  if [ -f "/root/$repo/.env" ]; then
    cp "/root/$repo/.env" "/tmp/$repo/.env" 2>/dev/null || true
  fi
done

cd /tmp/9nau/apps/api && npx prisma migrate dev --name init --skip-generate 2>&1 | grep -E "✔|error|Migration" &
cd /tmp/nauthenticity && npx prisma migrate dev --name init --skip-generate 2>&1 | grep -E "✔|error|Migration" &
cd /tmp/flownau && npx prisma migrate dev --name init --skip-generate 2>&1 | grep -E "✔|error|Migration" &
cd /tmp/whatsnau/packages/backend && npx prisma migrate dev --name init --skip-generate 2>&1 | grep -E "✔|error|Migration" &
cd /tmp/zazu/packages/db && npx prisma migrate dev --name init --skip-generate 2>&1 | grep -E "✔|error|Migration" &
wait
echo "All done"
