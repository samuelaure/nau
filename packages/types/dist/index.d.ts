export declare enum WorkspaceRole {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    MEMBER = "MEMBER"
}
export declare enum SocialPlatform {
    INSTAGRAM = "INSTAGRAM",
    TIKTOK = "TIKTOK",
    YOUTUBE = "YOUTUBE",
    TWITTER = "TWITTER"
}
export declare enum SocialProfileRole {
    OWNED = "OWNED",
    COMMENT_TARGET = "COMMENT_TARGET",
    BENCHMARK_TARGET = "BENCHMARK_TARGET",
    INSPIRATION = "INSPIRATION"
}
export declare enum PromptOwnerType {
    WORKSPACE = "WORKSPACE",
    BRAND = "BRAND",
    USER = "USER"
}
export declare enum PromptType {
    VOICE = "VOICE",
    IDEAS_FRAMEWORK = "IDEAS_FRAMEWORK",
    CONTENT_PERSONA = "CONTENT_PERSONA",
    COMPOSITOR = "COMPOSITOR",
    CAPTION = "CAPTION",
    COMMENT_STRATEGY = "COMMENT_STRATEGY",
    BENCHMARK_CHAT = "BENCHMARK_CHAT"
}
export interface User {
    id: string;
    email: string;
    name: string | null;
    telegramId: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface Workspace {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    createdAt: string;
    updatedAt: string;
}
export interface WorkspaceMember {
    id: string;
    userId: string;
    workspaceId: string;
    role: WorkspaceRole;
    createdAt: string;
    user: Pick<User, 'id' | 'email' | 'name'>;
}
export interface Brand {
    id: string;
    workspaceId: string;
    name: string;
    handle: string;
    timezone?: string;
    isActive?: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface SocialProfile {
    id: string;
    brandId: string;
    platform: SocialPlatform;
    platformId: string;
    handle: string;
    displayName: string | null;
    role: SocialProfileRole;
    createdAt: string;
    updatedAt: string;
}
export interface Prompt {
    id: string;
    ownerType: PromptOwnerType;
    ownerId: string;
    type: PromptType;
    body: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreateWorkspaceDto {
    name: string;
    slug?: string;
    timezone?: string;
}
export interface UpdateWorkspaceDto {
    name?: string;
    slug?: string;
    timezone?: string;
}
export interface CreateBrandDto {
    name: string;
    handle?: string;
    timezone?: string;
}
export interface UpdateBrandDto {
    name?: string;
    handle?: string;
}
export interface Project {
    id: string;
    workspaceId: string;
    brandId?: string | null;
    name: string;
    description?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface CreateProjectDto {
    name: string;
    description?: string;
    brandId?: string;
}
export interface UpdateProjectDto {
    name?: string;
    description?: string;
    brandId?: string | null;
    isActive?: boolean;
}
export interface CreateSocialProfileDto {
    platform: SocialPlatform;
    platformId: string;
    handle: string;
    displayName?: string;
    role: SocialProfileRole;
}
export interface UpdateSocialProfileDto {
    handle?: string;
    displayName?: string;
    role?: SocialProfileRole;
}
export interface UpsertPromptDto {
    ownerType: PromptOwnerType;
    ownerId: string;
    type: PromptType;
    body: string;
}
export interface PromptFilter {
    ownerType?: PromptOwnerType;
    ownerId?: string;
    types?: PromptType[];
}
export interface AccessTokenPayload {
    sub: string;
    workspaceId: string;
    role: WorkspaceRole;
    iat: number;
    exp: number;
}
export interface ServiceTokenPayload {
    iss: string;
    aud: string;
    iat: number;
    exp: number;
}
export interface LoginDto {
    email: string;
    password: string;
}
export interface RegisterDto {
    email: string;
    password: string;
    name?: string;
}
export interface AuthTokensResponse {
    accessToken: string;
    expiresIn: number;
}
export interface Block {
    id: string;
    type: string;
    properties: Record<string, unknown>;
    parentId: string | null;
    uuid: string;
    source: string | null;
    sourceRef: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}
export interface CreateBlockDto {
    type: string;
    parentId?: string | null;
    properties: Record<string, unknown>;
    workspaceId?: string;
    userId?: string;
    /**
     * When it is due, set in the same request that creates it.
     *
     * Typing a line and scheduling it are one act from the person's side, and
     * splitting them into two calls left a window where a block existed but was
     * due nowhere. Present in `apps/api`'s own `CreateBlockDto`
     * (`apps/api/src/blocks/dto/create-block.dto.ts`) since the Time rebuild;
     * missing here until now, which is the class of drift nau#66 tracks — one
     * canonical type, several hand-copied shadows of it.
     */
    planning?: {
        /** Which time system it is placed in. Defaults to Gregorian. */
        system?: string;
        /** Which of that system's scales — 'day', 'week', 'month'… */
        scale?: string;
        /** Any instant inside the period being planned into. */
        anchor: string;
        /** The repetition rule, in the dialect its system speaks. */
        recurrence?: string | null;
        recurrenceTimezone?: string | null;
        recurrenceMode?: 'FIXED' | 'AFTER_COMPLETION';
    };
}
export interface UpdateBlockDto {
    type?: string;
    parentId?: string | null;
    properties?: Record<string, unknown>;
}
export interface Tag {
    id: string;
    workspaceId: string;
    name: string;
    color: string | null;
    parentId: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface CreateTagDto {
    name: string;
    parentId?: string | null;
    color?: string;
}
export interface UpdateTagDto {
    name?: string;
    parentId?: string | null;
    color?: string | null;
}
export interface Schedule {
    startDate: string;
    rrule?: string;
}
/** What the Time module sends to ask for a synthesis. */
export interface GenerateSynthesisDto {
    workspaceId: string;
    from: string;
    to: string;
    sourceKind: 'entries' | 'syntheses';
    sourceIds: string[];
}
/**
 * What a capture service sends to `POST /triage`.
 *
 * The wire contract between Zazŭ (and any future capture client) and the API.
 * It lives here rather than in either service because a body assembled as an
 * object literal on one side and destructured on the other agrees only by
 * coincidence: `rawText` was sent for weeks after the field stopped being read,
 * and nothing said so.
 *
 * Being here does not make the request typed — an HTTP body is `unknown` until
 * something validates it. What it does is make a drift visible at compile time
 * to whichever side changes first.
 */
export interface TriageRequestDto {
    /** The capture, already cleaned by whoever transcribed it. */
    text: string;
    /** naŭ user id, or a Telegram id the API will resolve to one. */
    userId?: string;
    /** The capture record this came from, in the caller's own database. */
    sourceBlockId?: string;
    brandId?: string | null;
    workspaceId?: string;
    /**
     * Skip classification: the caller already knows this is a diary entry.
     * The API files it through Journal without a model call.
     */
    journalOnly?: boolean;
    /**
     * When the capture was recorded, not when it was sent. Without it an entry
     * lands on the day ingestion finished, which is wrong whenever that lags.
     */
    capturedAt?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}
//# sourceMappingURL=index.d.ts.map