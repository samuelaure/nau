import axios from 'axios';

// Sanitize URL to remove accidental quotes, whitespace, or trailing semicolons
const rawUrl = import.meta.env.VITE_API_URL || '/api/v1';
export const API_URL = rawUrl.replace(/['";]/g, '').trim();

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// On 401, session has expired — redirect to logout which clears cookies and returns to landing.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.replace('/auth/logout');
    }
    return Promise.reject(error);
  },
);

export const getMediaUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/content')) {
    if (API_URL.startsWith('http')) {
      try {
        const urlObj = new URL(API_URL);
        return `${urlObj.origin}${url}`;
      } catch (e) {
        return url;
      }
    }
    return url;
  }
  return url;
};

export const getPlatformLogo = (platform: string = 'instagram') => {
  // Instagram logo SVG as data URI
  const logos: Record<string, string> = {
    instagram: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e1306c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2' y='2' width='20' height='20' rx='5' ry='5'%3E%3C/rect%3E%3Cpath d='M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z'%3E%3C/path%3E%3Ccircle cx='17.5' cy='6.5' r='1.5'%3E%3C/circle%3E%3C/svg%3E`,
  };
  return logos[platform] || logos.instagram;
};

export const getProfileImageUrl = (imageUrl?: string | null, platform: string = 'instagram') => {
  if (imageUrl) {
    return getMediaUrl(imageUrl);
  }
  return getPlatformLogo(platform);
};

export interface SocialProfile {
  id: string;
  platform: string;
  username: string;
  profileImageUrl: string | null;
  lastScrapedAt: string;
  _count?: {
    posts: number;
  };
}

/** @deprecated Use SocialProfile */
export type Account = SocialProfile;

export interface Transcript {
  id: string;
  text: string;
  json?: any;
}

export interface Post {
  id: string;
  instagramUrl: string;
  caption?: string;
  postedAt: string;
  likes: number;
  comments: number;
  views?: number;
  engagementScore?: number;
  username?: string;
  media: Media[];
  transcripts?: Transcript[];
  collaborators?: { username: string; profilePicUrl?: string; role?: string }[];
  newerPostId?: string | null;
  olderPostId?: string | null;
}

export interface SocialProfileDetails extends SocialProfile {
  posts: Post[];
}

/** @deprecated Use SocialProfileDetails */
export type AccountDetails = SocialProfileDetails;

export interface Media {
  id: string;
  type: 'video' | 'image';
  storageUrl: string;
  thumbnailUrl?: string; // Added for fast loading
  duration?: number;
}

export interface QueueJob {
  id: string;
  name: string;
  data: any;
  timestamp: number;
  failedReason?: string;
  progress: number;
  progressData?: any;
  processedOn?: number;
  finishedOn?: number;
  opts: any;
  attemptsMade?: number;
}

export interface QueueMetrics {
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  active: QueueJob[];
  waiting: QueueJob[];
  failed: QueueJob[];
}

export interface QueueStatus {
  download: QueueMetrics;
  compute: QueueMetrics;
  ingestion: QueueMetrics;
}

export const getProfiles = async () => {
  const { data } = await api.get<{ accounts: SocialProfile[] } | SocialProfile[]>('/accounts');
  return Array.isArray(data) ? data : (data as { accounts: SocialProfile[] }).accounts;
};

export const getProfile = async (username: string) => {
  const { data } = await api.get<SocialProfileDetails>(`/accounts/${username}`);
  return data;
};

/** @deprecated Use getProfiles */
export const getAccounts = getProfiles;
/** @deprecated Use getProfile */
export const getAccount = getProfile;

export const getPost = async (id: string) => {
  const { data } = await api.get<Post>(`/posts/${id}`);
  return data;
};

export const updatePost = async (
  id: string,
  updates: { caption?: string; transcriptText?: string },
) => {
  const { data } = await api.put(`/posts/${id}`, updates);
  return data;
};

export const ingestAccount = async (payload: {
  username: string;
  limit: number;
  updateSync?: boolean;
}) => {
  const { data } = await api.post('/ingest', payload);
  return data;
};

export const getQueueStatus = async () => {
  const { data } = await api.get<QueueStatus>('/queue');
  return data;
};

export const deleteJob = async (queueName: string, jobId: string) => {
  const { data } = await api.post('/queue/delete-job', { queueName, jobId });
  return data;
};

export interface PostProgress {
  id: string;
  instagramId: string;
  postedAt: string;
  caption: string | null;
  mediaCount: number;
  downloaded: boolean;
  hasVideo: boolean;
  transcribed: boolean;
  transcriptPreview: string | null;
}

export interface ProfileProgress {
  summary: {
    totalPosts: number;
    totalMedia: number;
    localMedia: number;
    pendingDownloads: number;
    downloadPct: number;
    videoPostsTotal: number;
    transcribedPosts: number;
    transcriptPct: number;
    totalTranscripts: number;
    phase: string;
    isPaused: boolean;
  };
  activeJobs: Array<{
    id: string;
    name: string;
    progress: number;
    data: any;
    timestamp: number;
    progressData?: {
      step?: string;
      currentItem?: {
        username: string;
        postedAt: string;
        type: string;
      };
    };
  }>;
  posts: PostProgress[];
}

export const getProfileProgress = async (username: string) => {
  const { data } = await api.get<ProfileProgress>(`/accounts/${username}/progress`);
  return data;
};

/** @deprecated Use getProfileProgress */
export const getAccountProgress = getProfileProgress;

export const abortIngestion = async (username: string) => {
  const { data } = await api.post('/abort', { username });
  return data;
};

export const pauseIngestion = async (username: string) => {
  const { data } = await api.post('/pause', { username });
  return data;
};

export const resumeIngestion = async (username: string) => {
  const { data } = await api.post('/resume', { username });
  return data;
};

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface NauBrand {
  id: string
  workspaceId: string
  name: string
  timezone: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface NauWorkspace {
  id: string
  name: string
  role: WorkspaceRole
  brands: NauBrand[]
  createdAt: string
  updatedAt: string
}

export const getWorkspaces = async (): Promise<NauWorkspace[]> => {
  const { data } = await api.get<NauWorkspace[]>('/workspaces');
  return data;
};

export const getBrands = async (workspaceId: string): Promise<NauBrand[]> => {
  const { data } = await api.get<NauBrand[]>(`/workspaces/${workspaceId}/brands`);
  return data;
};

export const createBrand = async (workspaceId: string, name: string): Promise<NauBrand> => {
  const { data } = await api.post<NauBrand>(`/workspaces/${workspaceId}/brands`, { name });
  return data;
};

export const getBrandIntelligence = async (brandId: string) => {
  const { data } = await api.get(`/brands/${brandId}/intelligence`);
  return data;
};

export const patchBrandIntelligence = async (brandId: string, patch: Record<string, unknown>) => {
  const { data } = await api.patch(`/brands/${brandId}/intelligence`, patch);
  return data;
};

export const getBrandOwnedProfiles = async (brandId: string) => {
  const { data } = await api.get<SocialProfile[]>(`/brands/${brandId}/owned-profiles`);
  return data;
};

export const getInspoItems = async (brandId: string) => {
  const { data } = await api.get(`/brands/${brandId}/inspo`);
  return data;
};

export const getInspoDigest = async (brandId: string) => {
  const { data } = await api.get(`/brands/${brandId}/inspo/digest`);
  return data;
};

export const updateInspoItem = async (id: string, brandId: string, updates: any) => {
  const { data } = await api.patch(`/brands/${brandId}/inspo/${id}`, updates);
  return data;
};

export const getBrandTargets = async (brandId: string, targetType?: string) => {
  const url = targetType
    ? `/targets?brandId=${brandId}&targetType=${targetType}`
    : `/targets?brandId=${brandId}`;
  const { data } = await api.get(url);
  return data;
};

export const addBrandTarget = async (payload: {
  brandId: string;
  username: string;
  targetType: string;
  isActive?: boolean;
  initialDownloadCount?: number;
  autoUpdate?: boolean;
}) => {
  const { data } = await api.post(`/targets`, payload);
  return data;
};

export const updateBrandTarget = async (
  id: string,
  updates: { isActive?: boolean; autoUpdate?: boolean; initialDownloadCount?: number },
) => {
  const { data } = await api.patch(`/targets/${id}`, updates);
  return data;
};

export const generateComment = async (payload: { brandId: string; targetUrl: string }) => {
  const { data } = await api.post(`/generate-comment`, payload);
  return data;
};
