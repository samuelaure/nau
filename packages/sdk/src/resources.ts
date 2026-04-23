import type {
  User,
  Workspace,
  WorkspaceMember,
  Brand,
  SocialProfile,
  Prompt,
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  CreateBrandDto,
  UpdateBrandDto,
  CreateSocialProfileDto,
  UpdateSocialProfileDto,
  UpsertPromptDto,
  PromptFilter,
  WorkspaceRole,
} from '@nau/types'
import { NauHttpClient } from './http'

// ── Workspaces ─────────────────────────────────────────────────────────────────

export class WorkspacesResource {
  constructor(private readonly http: NauHttpClient, private readonly prefix = '') {}

  list(): Promise<Workspace[]> {
    return this.http.get(`${this.prefix}/workspaces`)
  }

  get(workspaceId: string): Promise<Workspace> {
    return this.http.get(`${this.prefix}/workspaces/${workspaceId}`)
  }

  create(dto: CreateWorkspaceDto): Promise<Workspace> {
    return this.http.post(`${this.prefix}/workspaces`, dto)
  }

  update(workspaceId: string, dto: UpdateWorkspaceDto): Promise<Workspace> {
    return this.http.patch(`${this.prefix}/workspaces/${workspaceId}`, dto)
  }

  delete(workspaceId: string): Promise<void> {
    return this.http.delete(`${this.prefix}/workspaces/${workspaceId}`)
  }

  getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.http.get(`${this.prefix}/workspaces/${workspaceId}/members`)
  }

  addMember(workspaceId: string, dto: { email: string; role?: WorkspaceRole }): Promise<WorkspaceMember> {
    return this.http.post(`${this.prefix}/workspaces/${workspaceId}/members`, dto)
  }

  removeMember(workspaceId: string, userId: string): Promise<void> {
    return this.http.delete(`${this.prefix}/workspaces/${workspaceId}/members/${userId}`)
  }
}

// ── Brands ─────────────────────────────────────────────────────────────────────

export class BrandsResource {
  constructor(private readonly http: NauHttpClient, private readonly prefix = '') {}

  list(workspaceId: string): Promise<Brand[]> {
    return this.http.get(`${this.prefix}/workspaces/${workspaceId}/brands`)
  }

  get(brandId: string): Promise<Brand> {
    return this.http.get(`${this.prefix}/brands/${brandId}`)
  }

  create(workspaceId: string, dto: CreateBrandDto): Promise<Brand> {
    return this.http.post(`${this.prefix}/workspaces/${workspaceId}/brands`, dto)
  }

  update(brandId: string, dto: UpdateBrandDto): Promise<Brand> {
    return this.http.patch(`${this.prefix}/brands/${brandId}`, dto)
  }

  delete(brandId: string): Promise<void> {
    return this.http.delete(`${this.prefix}/brands/${brandId}`)
  }
}

// ── Social Profiles ────────────────────────────────────────────────────────────

export class SocialProfilesResource {
  constructor(private readonly http: NauHttpClient, private readonly prefix = '') {}

  list(brandId: string): Promise<SocialProfile[]> {
    return this.http.get(`${this.prefix}/brands/${brandId}/social-profiles`)
  }

  get(profileId: string): Promise<SocialProfile> {
    return this.http.get(`${this.prefix}/social-profiles/${profileId}`)
  }

  create(brandId: string, dto: CreateSocialProfileDto): Promise<SocialProfile> {
    return this.http.post(`${this.prefix}/brands/${brandId}/social-profiles`, dto)
  }

  update(profileId: string, dto: UpdateSocialProfileDto): Promise<SocialProfile> {
    return this.http.patch(`${this.prefix}/social-profiles/${profileId}`, dto)
  }

  delete(profileId: string): Promise<void> {
    return this.http.delete(`${this.prefix}/social-profiles/${profileId}`)
  }
}

// ── Prompts ────────────────────────────────────────────────────────────────────

export class PromptsResource {
  constructor(private readonly http: NauHttpClient, private readonly prefix = '') {}

  list(filter?: PromptFilter): Promise<Prompt[]> {
    const params: Record<string, string> = {}
    if (filter?.ownerType) params['ownerType'] = filter.ownerType
    if (filter?.ownerId) params['ownerId'] = filter.ownerId
    if (filter?.types?.length) params['types'] = filter.types.join(',')
    return this.http.get(`${this.prefix}/prompts`, params)
  }

  upsert(dto: UpsertPromptDto): Promise<Prompt> {
    return this.http.put(`${this.prefix}/prompts`, dto)
  }

  delete(promptId: string): Promise<void> {
    return this.http.delete(`${this.prefix}/prompts/${promptId}`)
  }
}

// ── Users ──────────────────────────────────────────────────────────────────────

export class UsersResource {
  constructor(private readonly http: NauHttpClient) {}

  me(): Promise<User> {
    return this.http.get('/auth/me')
  }
}
