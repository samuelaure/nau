const ACCOUNTS_URL = import.meta.env.VITE_ACCOUNTS_URL ?? 'https://accounts.9nau.com';
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? 'https://nauthenticity.9nau.com';

export interface SessionUser {
  id: string;
  workspaceId?: string;
}

export async function checkSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch('/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    return res.json() as Promise<SessionUser>;
  } catch {
    return null;
  }
}

export function redirectToLogin(): void {
  const callbackUrl = `${DASHBOARD_URL}/auth/callback`;
  window.location.href = `${ACCOUNTS_URL}/login?continue=${encodeURIComponent(callbackUrl)}`;
}
