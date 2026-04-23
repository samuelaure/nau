import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { signServiceToken } from '@nau/auth';

@Injectable()
export class NauthenticityService {
  private readonly logger = new Logger(NauthenticityService.name);
  private readonly baseUrl: string;
  private readonly authSecret: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'NAUTHENTICITY_URL',
      'http://nauthenticity:4000',
    );
    this.authSecret = this.configService.getOrThrow<string>('AUTH_SECRET');
  }

  private async serviceHeaders(): Promise<Record<string, string>> {
    const token = await signServiceToken({
      iss: '9nau-api',
      aud: 'nauthenticity',
      secret: this.authSecret,
    });
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = await this.serviceHeaders();
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`nauthenticity ${options.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async addTargets(brandId: string, usernames: string[]) {
    this.logger.log(`Starting scraping runs for brand ${brandId}: ${usernames.join(', ')}`);
    return this.fetch('/_service/scraping/runs', {
      method: 'POST',
      body: JSON.stringify({ brandId, targets: usernames }),
    });
  }

  async generateComment(postUrl: string, brandId: string) {
    this.logger.log(`Generating comment for ${postUrl} (brand: ${brandId})`);
    return this.fetch<{ suggestions: string[] }>(`/_service/brands/${brandId}/generate-comment`, {
      method: 'POST',
      body: JSON.stringify({ postUrl }),
    });
  }

  async getBrandsForWorkspace(_workspaceId: string): Promise<Array<{ id: string; brandName: string; voicePrompt: string }>> {
    // Brand data is now owned by 9naŭ API — this method is a no-op
    return [];
  }

  async getBrandDnaLight(_brandId: string): Promise<{ id: string; brandName: string; voicePrompt: string; workspaceId: string } | null> {
    // Brand data is now owned by 9naŭ API — callers should query BrandsService directly
    return null;
  }

  async syncBrandStructuralData(_brandId: string, _data: { workspaceId?: string }) {
    // No-op: brand ownership has moved to 9naŭ API; nauthenticity no longer stores brand metadata
  }

  async getInspoItems(brandId: string, filters?: { type?: string; status?: string }) {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.fetch(`/_service/brands/${brandId}/inspo${qs}`);
  }

  async createInspoItem(brandId: string, data: { sourceUrl?: string; type: string; note?: string }) {
    return this.fetch(`/_service/brands/${brandId}/inspo`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInspoItem(brandId: string, id: string, data: { note?: string; status?: string; extractedHook?: string; extractedTheme?: string }) {
    return this.fetch(`/_service/brands/${brandId}/inspo/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}
