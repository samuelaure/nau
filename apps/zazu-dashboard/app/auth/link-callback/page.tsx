'use client';

export const dynamic = 'force-dynamic';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { linkTelegramAccount } from '../../lib/link-account';
import { Loader2 } from 'lucide-react';

function LinkCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { update } = useSession();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/');
      return;
    }

    linkTelegramAccount(token).then(async (result) => {
      if (result.success) {
        // Force the JWT to re-sync nauUserId from DB before navigating
        await update();
        router.replace('/');
      } else {
        console.error('Link failed:', result.error);
        router.replace('/');
      }
    });
  }, [searchParams, router, update]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <Loader2 className="animate-spin" size={40} color="var(--primary)" />
      <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Vinculando tu cuenta naŭ…</p>
    </div>
  );
}

export default function LinkCallbackPage() {
  return (
    <Suspense>
      <LinkCallbackHandler />
    </Suspense>
  );
}
