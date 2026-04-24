# Infrastructure

Central Traefik gateway and local development services for the naŭ platform.

## Structure

```
infrastructure/
├── gateway/
│   ├── docker-compose.yml   # Traefik reverse proxy — required in all environments
│   └── acme.json            # Let's Encrypt cert storage (gitignored, auto-created)
├── local/
│   ├── whisper/             # Whisper ASR — local dev only
│   │   └── docker-compose.yml
│   └── postgres-admin/      # (reserved) pgAdmin — local dev only
├── scripts/
│   ├── init-network.sh      # Create nau-network once before first service start
│   └── start-local.sh       # Start gateway + any local services
└── README.md
```

## Quick start

```bash
# First time only — create the shared Docker network
./scripts/init-network.sh

# Start gateway only
./scripts/start-local.sh

# Start gateway + Whisper transcription
./scripts/start-local.sh whisper
```

## The `nau-network`

Defined here and nowhere else. Every platform service attaches to it as `external: true`. Never redefine it in an app's `docker-compose.yml`.

## Gateway

Traefik v2.11 handles:
- HTTP → HTTPS redirect
- TLS termination via Let's Encrypt (prod) / self-signed (local)
- Routing by hostname to the correct container

Each app declares its own Traefik labels in its `docker-compose.yml`. The gateway picks them up automatically via Docker socket.

## Local services

These **never run in production**. They exist only for local development.

| Service | Path | RAM | Purpose |
|---|---|---|---|
| Whisper ASR | `local/whisper/` | ~2.5 GB | Audio → text transcription for nauthenticity |

Configure Whisper model via `WHISPER_MODEL` env var (default: `small`).
Options: `tiny` (1 GB), `base` (1.5 GB), `small` (2.5 GB), `medium` (5 GB).

## Adding a local service

1. Create `local/<name>/docker-compose.yml`
2. Attach to `nau-network` as `external: true`
3. Add Traefik labels with `<name>.localhost` hostname
4. Pass `<name>` to `start-local.sh` to start it
5. Document in this README with RAM usage
