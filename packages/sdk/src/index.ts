import { NauHttpClient, NauClientOptions, NauServiceClientOptions } from './http'
import { WorkspacesResource, BrandsResource, SocialProfilesResource, PromptsResource, UsersResource } from './resources'

export { NauApiError, NauUnauthorizedError, NauForbiddenError, NauNotFoundError } from './errors'
export type { NauClientOptions, NauServiceClientOptions } from './http'

export interface NauClient {
  workspaces: WorkspacesResource
  brands: BrandsResource
  socialProfiles: SocialProfilesResource
  prompts: PromptsResource
  users: UsersResource
}

export interface NauServiceClient extends NauClient {
  workspaces: WorkspacesResource
  brands: BrandsResource
  socialProfiles: SocialProfilesResource
  prompts: PromptsResource
  users: UsersResource
}

// User-context client (browser session / server action with user JWT)
export function createNauClient(options: NauClientOptions): NauClient {
  const http = new NauHttpClient(options)
  return {
    workspaces: new WorkspacesResource(http),
    brands: new BrandsResource(http),
    socialProfiles: new SocialProfilesResource(http),
    prompts: new PromptsResource(http),
    users: new UsersResource(http),
  }
}

// Service-to-service client (signs JWTs using service secret)
// Uses /_service/ routes which expect ServiceAuthGuard
export function createNauServiceClient(options: NauServiceClientOptions): NauServiceClient {
  const http = NauHttpClient.forService(options)
  return {
    workspaces: new WorkspacesResource(http, '/_service'),
    brands: new BrandsResource(http, '/_service'),
    socialProfiles: new SocialProfilesResource(http, '/_service'),
    prompts: new PromptsResource(http, '/_service'),
    users: new UsersResource(http),
  }
}

// Re-export all types from @nau/types for convenience
export * from '@nau/types'
