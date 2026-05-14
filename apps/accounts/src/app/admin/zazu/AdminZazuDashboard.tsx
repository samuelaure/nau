'use client'

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import {
  Settings, Send, ChevronLeft, ChevronRight, ArrowLeft,
  Loader2, Radio, User, CheckCircle2, XCircle, Clock
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ZazuUser = {
  id: string
  telegramId: string
  firstName: string | null
  lastName: string | null
  username: string | null
  displayName: string | null
  nauUserId: string | null
  forwardNotificationsToAdmin: boolean
  createdAt: string
  deliveryWindow: { startHour: number; endHour: number; timeZone: string } | null
  lastActivity: string
}

type MessageItem = {
  kind: 'message'
  id: string
  role: 'USER' | 'ASSISTANT' | 'ADMIN'
  content: string
  createdAt: string
}

type NotificationItem = {
  kind: 'notification'
  id: string
  brandName: string | null
  payloadType: string
  payloadJson: Record<string, unknown>
  status: string
  sentAt: string | null
  createdAt: string
}

type BroadcastItem = {
  kind: 'broadcast'
  id: string
  message: string
  sentCount: number
  createdAt: string
}

type ChatItem = MessageItem | NotificationItem | BroadcastItem

type ActiveChat = { type: 'user'; user: ZazuUser } | { type: 'broadcast' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function userInitials(u: ZazuUser): string {
  const name = u.displayName ?? u.firstName ?? u.username ?? '?'
  return name.slice(0, 2).toUpperCase()
}

function userName(u: ZazuUser): string {
  return u.displayName ?? u.firstName ?? u.username ?? `#${u.telegramId}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function itemTimestamp(item: ChatItem): string {
  return item.createdAt
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  content_brief: 'Content Brief',
  approval_digest_today: 'Approval — Today',
  approval_digest_tomorrow: 'Approval — Tomorrow',
  approval_next_in_line: 'Next in Line',
  calendar_fill_blocked: 'Calendar Blocked',
  journal_summary: 'Journal Summary',
  comment_suggestions: 'Comment Suggestions',
}

function extractNotificationText(item: NotificationItem): string {
  const p = item.payloadJson as any
  if (p.markdown) return p.markdown
  if (p.summaryData) return `📊 ${p.periodTitle ?? 'Summary'}\n\n${p.summaryData}`
  if (Array.isArray(p.suggestions)) {
    const lines = (p.suggestions as string[])
      .map((s, i) => `Option ${i + 1}:\n${s}`)
      .join('\n\n')
    return `${p.brandName ? `${p.brandName} — ` : ''}Suggestions for @${p.targetUsername ?? ''}\n\n${lines}`
  }
  return item.payloadType
}

function NotificationStatusBadge({ status }: { status: string }) {
  if (status === 'SENT') return <CheckCircle2 size={12} className="text-green-400 shrink-0" />
  if (status === 'FAILED') return <XCircle size={12} className="text-red-400 shrink-0" />
  return <Clock size={12} className="text-yellow-400 shrink-0" />
}

// ── Bubble components ─────────────────────────────────────────────────────────

function isOutgoing(item: ChatItem): boolean {
  if (item.kind === 'broadcast') return true
  if (item.kind === 'notification') return true
  if (item.kind === 'message') return item.role !== 'USER'
  return false
}

function MessageBubble({ item }: { item: ChatItem }) {
  const out = isOutgoing(item)

  if (item.kind === 'message') {
    return (
      <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
            out
              ? 'bg-violet-600 text-white rounded-br-sm'
              : 'bg-white/10 text-white/90 rounded-bl-sm'
          }`}
        >
          {item.role === 'ADMIN' && (
            <span className="block text-[10px] text-white/50 mb-1 uppercase tracking-wide">Admin</span>
          )}
          {item.content}
          <span className={`block text-[10px] mt-1 ${out ? 'text-white/50' : 'text-white/40'} text-right`}>
            {formatTime(item.createdAt)}
          </span>
        </div>
      </div>
    )
  }

  if (item.kind === 'broadcast') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[72%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm bg-violet-600/70 text-white whitespace-pre-wrap break-words">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Radio size={11} className="text-white/60" />
            <span className="text-[10px] text-white/60 uppercase tracking-wide">Broadcast</span>
            <span className="text-[10px] text-white/40 ml-auto">{item.sentCount} recipients</span>
          </div>
          {item.message}
          <span className="block text-[10px] mt-1 text-white/50 text-right">
            {formatTime(item.createdAt)}
          </span>
        </div>
      </div>
    )
  }

  // notification
  const text = extractNotificationText(item)
  const label = NOTIFICATION_TYPE_LABELS[item.payloadType] ?? item.payloadType
  return (
    <div className="flex justify-end">
      <div className="max-w-[72%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm bg-violet-500/60 text-white whitespace-pre-wrap break-words">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] text-white/60 uppercase tracking-wide">{label}</span>
          {item.brandName && (
            <span className="text-[10px] text-white/40">· {item.brandName}</span>
          )}
          <NotificationStatusBadge status={item.status} />
        </div>
        {text}
        <span className="block text-[10px] mt-1 text-white/50 text-right">
          {formatTime(item.createdAt)}
        </span>
      </div>
    </div>
  )
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export function AdminZazuDashboard({ initialUsers }: { initialUsers: ZazuUser[] }) {
  const [users, setUsers] = useState<ZazuUser[]>(initialUsers)
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null)
  const [viewMode, setViewMode] = useState<'chat' | 'profile'>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatItems, setChatItems] = useState<ChatItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number>(0)

  // ── Load chat ──────────────────────────────────────────────────────────────

  const fetchChatPage = useCallback(async (chat: ActiveChat, before?: string): Promise<{ items: ChatItem[]; hasMore: boolean }> => {
    const qs = new URLSearchParams({ limit: '50' })
    if (before) qs.set('before', before)

    let url: string
    if (chat.type === 'broadcast') {
      url = `/api/admin/zazu/broadcast/history?${qs}`
    } else {
      url = `/api/admin/zazu/users/${chat.user.id}/chat?${qs}`
    }

    const res = await fetch(url)
    if (!res.ok) return { items: [], hasMore: false }
    return res.json()
  }, [])

  useEffect(() => {
    if (!activeChat) return
    setLoadingChat(true)
    setChatItems([])
    setHasMore(false)

    fetchChatPage(activeChat).then(({ items, hasMore }) => {
      // API returns desc; reverse for chronological display
      setChatItems([...items].reverse())
      setHasMore(hasMore)
      setLoadingChat(false)
    })
  }, [activeChat, fetchChatPage])

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loadingChat && chatItems.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [loadingChat])

  // Preserve scroll position after prepending older messages
  useLayoutEffect(() => {
    if (loadingMore || !scrollRef.current) return
    const el = scrollRef.current
    const newScrollHeight = el.scrollHeight
    const diff = newScrollHeight - prevScrollHeightRef.current
    if (diff > 0) {
      el.scrollTop = el.scrollTop + diff
    }
  }, [chatItems, loadingMore])

  // ── Load more (scroll up) ──────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!activeChat || loadingMore || !hasMore || chatItems.length === 0) return
    setLoadingMore(true)

    if (scrollRef.current) {
      prevScrollHeightRef.current = scrollRef.current.scrollHeight
    }

    const oldest = chatItems[0]
    const { items, hasMore: more } = await fetchChatPage(activeChat, itemTimestamp(oldest))
    setChatItems(prev => [...[...items].reverse(), ...prev])
    setHasMore(more)
    setLoadingMore(false)
  }, [activeChat, loadingMore, hasMore, chatItems, fetchChatPage])

  // IntersectionObserver on scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { root: scrollRef.current, threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  // ── Send message ───────────────────────────────────────────────────────────

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || !activeChat || sending) return
    setSending(true)

    const url = activeChat.type === 'broadcast'
      ? '/api/admin/zazu/broadcast'
      : '/api/admin/zazu/message'

    const body = activeChat.type === 'broadcast'
      ? { message: message.trim() }
      : { telegramId: activeChat.user.telegramId, message: message.trim() }

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setMessage('')
    setSending(false)

    // Refresh chat after send
    if (activeChat) {
      const { items, hasMore: more } = await fetchChatPage(activeChat)
      setChatItems([...items].reverse())
      setHasMore(more)
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }, 50)
    }
  }

  // ── Update forwarding toggle ───────────────────────────────────────────────

  async function handleForwardToggle(user: ZazuUser, value: boolean) {
    await fetch(`/api/admin/zazu/users/${user.id}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forwardNotificationsToAdmin: value }),
    })
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, forwardNotificationsToAdmin: value } : u))
    if (activeChat?.type === 'user' && activeChat.user.id === user.id) {
      setActiveChat({ type: 'user', user: { ...user, forwardNotificationsToAdmin: value } })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const activeUser = activeChat?.type === 'user' ? activeChat.user : null

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <aside className="w-72 shrink-0 border-r border-white/10 flex flex-col overflow-hidden">
          <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
            <h1 className="text-sm font-semibold text-white/80 tracking-wide uppercase">Zazŭ Admin</h1>
            <button onClick={() => setSidebarOpen(false)} className="text-white/40 hover:text-white/70 transition">
              <ChevronLeft size={18} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* Broadcast contact */}
            <button
              onClick={() => { setActiveChat({ type: 'broadcast' }); setViewMode('chat') }}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition border-b border-white/5 ${
                activeChat?.type === 'broadcast' ? 'bg-violet-600/20' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-violet-600/30 flex items-center justify-center shrink-0">
                <Radio size={16} className="text-violet-400" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">BROADCAST (All)</p>
                <p className="text-xs text-white/40 truncate">Send to all users</p>
              </div>
            </button>

            {/* User list */}
            {users.map(user => (
              <UserRow
                key={user.id}
                user={user}
                isActive={activeChat?.type === 'user' && activeChat.user.id === user.id}
                onSelect={() => { setActiveChat({ type: 'user', user }); setViewMode('chat') }}
                onProfile={() => { setActiveChat({ type: 'user', user }); setViewMode('profile') }}
              />
            ))}
          </div>
        </aside>
      )}

      {/* ── Main area ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/30">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="absolute top-4 left-4 text-white/40 hover:text-white/70 transition">
                <ChevronRight size={18} />
              </button>
            )}
            <User size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Select a user to view the conversation</p>
          </div>
        ) : viewMode === 'profile' && activeUser ? (
          /* ── Profile view ──────────────────────────────────────────────── */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="text-white/40 hover:text-white/70 transition mr-1">
                  <ChevronRight size={18} />
                </button>
              )}
              <button onClick={() => setViewMode('chat')} className="text-white/40 hover:text-white/80 transition">
                <ArrowLeft size={18} />
              </button>
              <div className="w-8 h-8 rounded-full bg-violet-700/50 flex items-center justify-center text-xs font-semibold shrink-0">
                {userInitials(activeUser)}
              </div>
              <span className="font-medium text-white/90">{userName(activeUser)}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* User metadata */}
              <section className="glass p-5 space-y-3">
                <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide">User Info</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-white/40 w-32 shrink-0">Display name</dt>
                    <dd className="text-white/80">{activeUser.displayName ?? '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-white/40 w-32 shrink-0">Telegram ID</dt>
                    <dd className="text-white/80 font-mono">{activeUser.telegramId}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-white/40 w-32 shrink-0">Username</dt>
                    <dd className="text-white/80">{activeUser.username ? `@${activeUser.username}` : '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-white/40 w-32 shrink-0">naŭ Account</dt>
                    <dd className={activeUser.nauUserId ? 'text-green-400' : 'text-white/40'}>
                      {activeUser.nauUserId ? 'Linked' : 'Not linked'}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-white/40 w-32 shrink-0">Joined</dt>
                    <dd className="text-white/80">{new Date(activeUser.createdAt).toLocaleDateString()}</dd>
                  </div>
                  {activeUser.deliveryWindow && (
                    <div className="flex gap-2">
                      <dt className="text-white/40 w-32 shrink-0">Delivery window</dt>
                      <dd className="text-white/80">
                        {activeUser.deliveryWindow.startHour}:00 – {activeUser.deliveryWindow.endHour}:00 {activeUser.deliveryWindow.timeZone}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Settings */}
              <section className="glass p-5 space-y-4">
                <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide">Settings</h2>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/80 font-medium">Forward notifications to admin</p>
                    <p className="text-xs text-white/40 mt-0.5 max-w-xs">
                      Platform notifications sent to this user will also be forwarded to your Telegram.
                    </p>
                  </div>
                  <Toggle
                    value={activeUser.forwardNotificationsToAdmin}
                    onChange={v => handleForwardToggle(activeUser, v)}
                  />
                </div>
              </section>
            </div>
          </div>

        ) : (
          /* ── Chat view ─────────────────────────────────────────────────── */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center gap-3 shrink-0">
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="text-white/40 hover:text-white/70 transition mr-1">
                  <ChevronRight size={18} />
                </button>
              )}
              {activeChat.type === 'broadcast' ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-violet-600/30 flex items-center justify-center shrink-0">
                    <Radio size={15} className="text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/90">BROADCAST (All)</p>
                    <p className="text-xs text-white/40">{users.length} users</p>
                  </div>
                </>
              ) : activeUser ? (
                <button
                  onClick={() => setViewMode('profile')}
                  className="flex items-center gap-3 group flex-1 min-w-0"
                >
                  <div className="w-8 h-8 rounded-full bg-violet-700/50 flex items-center justify-center text-xs font-semibold shrink-0">
                    {userInitials(activeUser)}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold text-white/90 group-hover:text-white transition truncate">
                      {userName(activeUser)}
                      {!activeUser.nauUserId && (
                        <span className="ml-2 text-[10px] text-white/30 font-normal border border-white/20 rounded px-1 py-0.5 align-middle">
                          not linked
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {activeUser.username ? `@${activeUser.username} · ` : ''}
                      {activeUser.telegramId}
                    </p>
                  </div>
                  <Settings size={15} className="text-white/20 group-hover:text-white/50 transition ml-auto shrink-0" />
                </button>
              ) : null}
            </div>

            {/* Message area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              {/* Scroll-up sentinel */}
              <div ref={sentinelRef} className="h-1" />

              {loadingMore && (
                <div className="flex justify-center py-2">
                  <Loader2 size={16} className="animate-spin text-white/30" />
                </div>
              )}

              {loadingChat ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 size={20} className="animate-spin text-white/30" />
                </div>
              ) : chatItems.length === 0 ? (
                <div className="flex justify-center items-center h-32">
                  <p className="text-sm text-white/20">No messages yet</p>
                </div>
              ) : (
                chatItems.map((item, i) => {
                  const prev = chatItems[i - 1]
                  const showSeparator = !prev || !isSameDay(itemTimestamp(prev), itemTimestamp(item))
                  return (
                    <div key={item.id}>
                      {showSeparator && (
                        <div className="flex items-center gap-3 py-3">
                          <div className="flex-1 h-px bg-white/10" />
                          <span className="text-[11px] text-white/30">{formatDateSeparator(itemTimestamp(item))}</span>
                          <div className="flex-1 h-px bg-white/10" />
                        </div>
                      )}
                      <MessageBubble item={item} />
                    </div>
                  )
                })
              )}
            </div>

            {/* Input */}
            {activeChat.type !== 'broadcast' || true ? (
              <form
                onSubmit={handleSend}
                className="px-5 py-4 border-t border-white/10 flex gap-3 items-end shrink-0"
              >
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend(e as any)
                    }
                  }}
                  rows={1}
                  placeholder={
                    activeChat.type === 'broadcast'
                      ? 'Message all users…'
                      : `Message ${activeUser ? userName(activeUser) : ''}…`
                  }
                  className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition max-h-32 overflow-y-auto"
                  style={{ minHeight: '42px' }}
                />
                <button
                  type="submit"
                  disabled={!message.trim() || sending}
                  className="h-[42px] w-10 flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

// ── UserRow ───────────────────────────────────────────────────────────────────

function UserRow({
  user, isActive, onSelect, onProfile,
}: {
  user: ZazuUser
  isActive: boolean
  onSelect: () => void
  onProfile: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const lastActive = new Date(user.lastActivity)
  const now = new Date()
  const diffMs = now.getTime() - lastActive.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  const lastActiveLabel = diffDays === 0
    ? formatTime(user.lastActivity)
    : diffDays === 1 ? 'Yesterday'
    : `${diffDays}d ago`

  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-white/5 transition ${
        isActive ? 'bg-violet-600/20' : 'hover:bg-white/5'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
    >
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-full bg-violet-900/60 flex items-center justify-center text-xs font-semibold text-white/80">
          {userInitials(user)}
        </div>
        {!user.nauUserId && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-black flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white/25" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-white/90 truncate">
            {userName(user)}
          </span>
          {!user.nauUserId && (
            <span className="text-[9px] text-white/25 border border-white/15 rounded px-1 shrink-0">
              unlinked
            </span>
          )}
        </div>
        <p className="text-[11px] text-white/35 truncate">
          {user.username ? `@${user.username}` : user.telegramId}
        </p>
      </div>

      <span className="text-[10px] text-white/30 shrink-0">
        {hovered ? '' : lastActiveLabel}
      </span>

      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onProfile() }}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition"
        >
          <Settings size={14} />
        </button>
      )}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
        value ? 'bg-violet-600' : 'bg-white/15'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
