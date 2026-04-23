# Phase 5: Zazŭ Context Routing

## Objectives
Equip Zazŭ with the functional intelligence to decipher which `Workspace` and `Brand` the user is actively commanding, both in the Web Dashboard and the Telegram Bot thread.

## Tasks

- [ ] **Dashboard Integration (`zazu/apps/next-dashboard` or equivalent UI)**
  - Integrate the cross-platform Workspace/Brand navigation dropdown.
  - Implement proxies to fetch the user's exact authorization clearance from `9nau-api`.
  - Filter all presented metrics, logs, and notification feeds utilizing the active `brandId` and `workspaceId` stored in the session state.

- [ ] **Bot Chat Context Routing (`zazu/apps/bot`)**
  - Infuse bot conversation sessions with an `activeBrandId` state variable.
  - Develop runtime interception logic: when a user initiates a domain-specific command (e.g. "Publish this", "Give me status"):
    - If the user sits in exactly ONE brand: auto-route execution silently.
    - If the user manages MULTIPLE brands: Halt and prompt the user via an Interactive Telegram Inline Keyboard (*"Which brand is this for?"*).
  - Implement brief contextual caching (via Redis) to prevent aggressive re-prompting during unbroken conversation flows.

## Verification Criteria
- [ ] The Zazŭ Dashboard accurately mirrors isolated data pertaining only to the selected Workspace and Brand context.
- [ ] A multi-workspace owner can effortlessly execute an action in Telegram and dynamically select the target brand pipeline via conversational buttons.
