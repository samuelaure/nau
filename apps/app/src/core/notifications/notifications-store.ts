import { create } from 'zustand'

/**
 * The one place an async outcome the user needs to know about — but that
 * must never block them — surfaces.
 *
 * The rule this exists to enforce (decided 2026-09-04, see nau#153): a
 * surface that closes on the user's own action (a modal, an editor) closes
 * immediately when they act, regardless of what the backend later says.
 * Their intent and their expectation were "this is done" — holding a modal
 * open, or reopening one, to relay a network failure violates that
 * expectation and reads as the app being broken, not as it being careful.
 * The backend's outcome, especially a failure, is decoupled from that UI
 * and delivered here instead: a toast with an action the user can actually
 * take (Reintentar, Deshacer, Abrir) rather than a wall they have to parse
 * mid-flow. This applies to every optimistic-close action — creating,
 * updating, deleting a block — not just the ones that happened to be
 * audited first.
 */

export type NotificationTone = 'error' | 'success' | 'info'

export interface Notification {
  id: string
  message: string
  tone: NotificationTone
  /** e.g. { label: 'Reintentar', onClick: () => mutation.mutate(...) }. */
  action?: { label: string; onClick: () => void }
  /** ms before auto-dismissal. Errors linger longer — they carry an action worth reading. */
  durationMs: number
}

interface NotificationsState {
  queue: Notification[]
  notify: (input: Omit<Notification, 'id' | 'durationMs'> & { durationMs?: number }) => string
  dismiss: (id: string) => void
}

const DEFAULT_DURATION: Record<NotificationTone, number> = {
  error: 6000,
  success: 3000,
  info: 3000,
}

let nextId = 0

export const useNotificationsStore = create<NotificationsState>((set) => ({
  queue: [],
  notify: ({ message, tone, action, durationMs }) => {
    // Not crypto.randomUUID(): universal in real browsers, but absent from
    // jsdom (jest's test environment) with no polyfill in this repo's test
    // setup — a toast id has no need for cryptographic uniqueness anyway,
    // just uniqueness within one session's queue.
    const id = `notification-${++nextId}`
    set((state) => ({
      queue: [...state.queue, { id, message, tone, action, durationMs: durationMs ?? DEFAULT_DURATION[tone] }],
    }))
    return id
  },
  dismiss: (id) => set((state) => ({ queue: state.queue.filter((n) => n.id !== id) })),
}))

/** The dispatch half, for call sites that only need to fire a notification (not read the queue — that's NotificationHost's job). */
export const notify = (input: Omit<Notification, 'id' | 'durationMs'> & { durationMs?: number }) =>
  useNotificationsStore.getState().notify(input)
