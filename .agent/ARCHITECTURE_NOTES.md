# naŭ Platform — Global Architecture Notes

> **Purpose**: Strategic design notes for future planning and implementation of platform-wide features.
> **Status**: Reference Only / Non-Active

---

## 1. Global Identity & SSO (Single Sign-On)

### Concept
A unified "naŭ Account" that allows a user to log in once and navigate seamlessly between `flownaŭ`, `9naŭ`, `whatsnaŭ`, and `nauthenticity` without re-authenticating.

### Proposed Architecture (OIDC Standard)
- **Identity Provider (IdP)**: Centralize user records in a single service (e.g., `nauthenticity` or a dedicated `nau-id` service).
- **Protocol**: Use **OAuth2 + OpenID Connect (OIDC)**.
- **Cross-Subdomain Session**: 
    - Configure the Auth Cookie (JWT) with `domain: ".9nau.com"`.
    - This allows `app.9nau.com`, `flownau.9nau.com`, and `targets.9nau.com` to share the same session.
- **Shared Secret**: All services must share the same `JWT_SECRET` (managed via production environment variables) to verify the central token.

---

## 2. Platform-Wide Media Storage (Cloudflare R2)

### Concept
Moving away from service-specific "hacks" (like the Telegram Vault) to a commercial-grade, S3-compatible object storage system.

### Industrial Standard Design
- **Single Bucket Strategy**: Use a single bucket (e.g., `nau-media-production`) to simplify lifecycle and IAM management.
- **Prefix Isolation (Virtual Folders)**:
    - `users/{userId}/captures/` -> Mobile Instagram captures.
    - `users/{userId}/voice/` -> Voice journal raw audio.
    - `users/{userId}/renders/` -> `flownaŭ` generated assets.
- **Upload Pattern (Pre-signed URLs)**:
    - Clients (Mobile/Web) request an upload URL from the API.
    - API generates a temporary S3 PutObject URL.
    - Client uploads **directly** to Cloudflare, bypassing Hetzner server bandwidth and RAM limits.
- **Delivery**: Serve through a dedicated Cloudflare Worker or CDN domain (e.g., `media.9nau.com`) for edge-caching and rapid playback.

---

## 3. Inter-Service Communication

### Concept
A "Service Mesh" approach where services interact reliably without tight coupling.

### Patterns
- **Primary**: Internal REST API calls over `nau-network` using `NAU_SERVICE_KEY` auth.
- **Secondary (Reactive)**: A shared Redis instance for basic event distribution (e.g., "New Capture" event).
- **Data Locality**: `nauthenticity` owns IG scraping data; `flownaŭ` owns content rendering; `9naŭ` owns the user's permanent Second Brain Record.
- **Orchestration**: `Zazŭ` acts as the primary "Command Router" for voice and user-facing notifications.

---

## 4. Implementation Strategy

- **Phase-by-Phase**: Never migrate everything at once. 
- **Migration Logic**: 
    1. Implement the new standard in a single service (`9naŭ API` first).
    2. Update its consumers (`9naŭ Mobile`).
    3. Once stable, propagate the pattern to `flownaŭ` and `nauthenticity`.
    4. Retire legacy bridges (Telegram Vault, Astromatic logic).
