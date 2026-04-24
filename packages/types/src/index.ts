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
}

export interface UpdateBrandDto {
  name?: string
  handle?: string
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
}

export interface UpdateBlockDto {
  type?: string
  parentId?: string | null
  properties?: Record<string, unknown>
}

// ── API response wrapper ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
