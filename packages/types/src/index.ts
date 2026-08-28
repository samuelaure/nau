// ── Enums ──────────────────────────────────────────────────────────────────────

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum SocialPlatform {
  INSTAGRAM = 'INSTAGRAM',
  TIKTOK = 'TIKTOK',
  YOUTUBE = 'YOUTUBE',
  TWITTER = 'TWITTER',
}

export enum SocialProfileRole {
  OWNED = 'OWNED',
  COMMENT_TARGET = 'COMMENT_TARGET',
  BENCHMARK_TARGET = 'BENCHMARK_TARGET',
  INSPIRATION = 'INSPIRATION',
}

export enum PromptOwnerType {
  WORKSPACE = 'WORKSPACE',
  BRAND = 'BRAND',
  USER = 'USER',
}

export enum PromptType {
  VOICE = 'VOICE',
  IDEAS_FRAMEWORK = 'IDEAS_FRAMEWORK',
  CONTENT_PERSONA = 'CONTENT_PERSONA',
  COMPOSITOR = 'COMPOSITOR',
  CAPTION = 'CAPTION',
  COMMENT_STRATEGY = 'COMMENT_STRATEGY',
  BENCHMARK_CHAT = 'BENCHMARK_CHAT',
}

// ── Entity DTOs ────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string | null
  telegramId: string | null
  createdAt: string
  updatedAt: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  timezone: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceMember {
  id: string
  userId: string
  workspaceId: string
  role: WorkspaceRole
  createdAt: string
  user: Pick<User, 'id' | 'email' | 'name'>
}

export interface Brand {
  id: string
  workspaceId: string
  name: string
  handle: string
  timezone?: string
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

export interface SocialProfile {
  id: string
  brandId: string
  platform: SocialPlatform
  platformId: string
  handle: string
  displayName: string | null
  role: SocialProfileRole
  createdAt: string
  updatedAt: string
}

export interface Prompt {
  id: string
  ownerType: PromptOwnerType
  ownerId: string
  type: PromptType
  body: string
  createdAt: string
  updatedAt: string
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

export interface CreateWorkspaceDto {
  name: string
  slug?: string
  timezone?: string
}

export interface UpdateWorkspaceDto {
  name?: string
  slug?: string
  timezone?: string
}

export interface CreateBrandDto {
  name: string
  handle?: string
  timezone?: string
}

export interface UpdateBrandDto {
  name?: string
  handle?: string
}

export interface Project {
  id: string
  workspaceId: string
  brandId?: string | null
  name: string
  description?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProjectDto {
  name: string
  description?: string
  brandId?: string
}

export interface UpdateProjectDto {
  name?: string
  description?: string
  brandId?: string | null
  isActive?: boolean
}

export interface CreateSocialProfileDto {
  platform: SocialPlatform
  platformId: string
  handle: string
  displayName?: string
  role: SocialProfileRole
}

export interface UpdateSocialProfileDto {
  handle?: string
  displayName?: string
  role?: SocialProfileRole
}

export interface UpsertPromptDto {
  ownerType: PromptOwnerType
  ownerId: string
  type: PromptType
  body: string
}

export interface PromptFilter {
  ownerType?: PromptOwnerType
  ownerId?: string
  types?: PromptType[]
}

// ── Auth DTOs ──────────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string
  workspaceId: string
  role: WorkspaceRole
  iat: number
  exp: number
}

export interface ServiceTokenPayload {
  iss: string
  aud: string
  iat: number
  exp: number
}

export interface LoginDto {
  email: string
  password: string
}

export interface RegisterDto {
  email: string
  password: string
  name?: string
}

export interface AuthTokensResponse {
  accessToken: string
  expiresIn: number
}

// ── Block ─────────────────────────────────────────────────────────────────────

export interface Block {
  id: string
  type: string
  properties: Record<string, unknown>
  parentId: string | null
  uuid: string
  source: string | null
  sourceRef: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// ── Block DTOs ────────────────────────────────────────────────────────────────

export interface CreateBlockDto {
  type: string
  parentId?: string | null
  properties: Record<string, unknown>
  workspaceId?: string
  userId?: string
}

export interface UpdateBlockDto {
  type?: string
  parentId?: string | null
  properties?: Record<string, unknown>
}

// ── Tag ───────────────────────────────────────────────────────────────────────

export interface Tag {
  id: string
  workspaceId: string
  name: string
  color: string | null
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTagDto {
  name: string
  parentId?: string | null
  color?: string
}

export interface UpdateTagDto {
  name?: string
  parentId?: string | null
  color?: string | null
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export interface Schedule {
  startDate: string
  rrule?: string
}

// ── Journal ───────────────────────────────────────────────────────────────────

/** Where a journal entry was captured. Not how — see JournalOriginFormat. */
export type JournalSource = 'zazu' | 'app' | 'mobile'

/**
 * What the capture was, before it became text.
 *
 * A label, not a dependency: Journal never learns what an audio key is or how
 * to play one back. It exists so the UI can tell a spoken entry from a typed
 * one without asking the originating service.
 */
export type JournalOriginFormat = 'voice' | 'text'

/**
 * A journal entry: one piece of text, and when it was lived.
 *
 * `text` is what the person reads and edits; `textOriginal` is that same text
 * as it first arrived, kept so an edit is always reversible in meaning. For a
 * voice note `textOriginal` is the cleaned transcription, never the raw one —
 * the raw audio and its first transcription stay with whoever captured them,
 * reachable through `sourceId`.
 */
export interface JournalEntryProperties {
  text: string
  textOriginal: string
  /** When it was lived, not when ingestion finished. */
  date: string
  source: JournalSource
  originFormat: JournalOriginFormat
  /** The capture record this came from, opaque to Journal. */
  sourceId?: string
  editedAt?: string
  sortOrder?: number
}

/** Whether a synthesis was built from entries or from smaller syntheses. */
export type SynthesisSourceKind = 'entries' | 'syntheses'

/** One thing a synthesis read, and the span it covered. */
export interface SynthesisSourceRef {
  id: string
  from: string
  to: string
}

/**
 * What a synthesis was built from.
 *
 * `kind` is homogeneous for the whole array: a synthesis reads entries or it
 * reads syntheses, never both. The span of each source is stored alongside its
 * id so the provenance of a synthesis can be read without fetching every
 * source it names.
 */
export interface SynthesisSource {
  kind: SynthesisSourceKind
  ids: SynthesisSourceRef[]
  count: number
}

/**
 * The commands used to produce a synthesis, as templates.
 *
 * Placeholders are left unresolved on purpose. What filled them is already
 * recoverable through `synthesisSource`, and keeping the resolved text here
 * would copy the person's own words into a field meant for auditing
 * instructions.
 */
export interface SynthesisPrompts {
  synthesisPrompt: string
  reflectionPrompt: string
}

/**
 * A period, interpreted.
 *
 * `synthesis` retells the span as one continuous experience; `reflection`
 * reads that synthesis back. They are generated by two separate model calls so
 * neither job contaminates the other, and shown to the person as one piece of
 * text — synthesis first.
 *
 * `from`/`to` describe the period this belongs to. They are a label, not a
 * query: what was read is exactly what `synthesisSource` names, which is
 * decided by the Time module and passed in.
 */
export interface JournalSynthesisProperties {
  synthesis: string
  synthesisOriginal: string
  reflection: string
  reflectionOriginal: string
  from: string
  to: string
  synthesisSource: SynthesisSource
  prompts: SynthesisPrompts
  editedAt?: string
  /** Set when a period held nothing to read; no model was called. */
  noData?: boolean
}

/** What the Time module sends to ask for a synthesis. */
export interface GenerateSynthesisDto {
  workspaceId: string
  from: string
  to: string
  sourceKind: SynthesisSourceKind
  sourceIds: string[]
}

// ── API response wrapper ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
