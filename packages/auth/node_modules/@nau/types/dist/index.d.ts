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
}
export interface UpdateBrandDto {
    name?: string;
    handle?: string;
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
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}
//# sourceMappingURL=index.d.ts.map