# Infrastructure

Traefik reverse proxy and the `nau-network` Docker bridge network.

## Start

```bash
# First time: create the shared Docker network
docker network create nau-network

# Start the gateway
cd infrastructure
docker compose up -d
```

## How it works

All platform services declare Traefik labels in their own `docker-compose.yml` and attach to `nau-network` as `external: true`. Traefik picks them up automatically via the Docker socket — no gateway config changes needed when adding a service.

`nau-network` is defined here and nowhere else. Never redefine it in an app compose file.

## TLS

Certificates are issued automatically by Let's Encrypt and stored in `acme.json` (gitignored). The file must exist with `600` permissions before first run:

```bash
touch infrastructure/acme.json && chmod 600 infrastructure/acme.json
```
