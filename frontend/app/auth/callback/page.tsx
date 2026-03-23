'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { completeAuthCallback } from '@/lib/authClient';
import { useStore } from '@/store/StoreContext';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { refreshAuth } = useStore();
  const refreshAuthRef = useRef(refreshAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshAuthRef.current = refreshAuth;
  }, [refreshAuth]);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      try {
        const { returnTo } = await completeAuthCallback();
        await refreshAuthRef.current();
        if (!isCancelled) {
          router.replace(returnTo);
        }
      } catch (callbackError) {
        if (!isCancelled) {
          const message =
            callbackError instanceof Error
              ? callbackError.message
              : 'Failed to complete sign-in callback';
          setError(message);
        }
      }
    };

    void run();
    return () => {
      isCancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <div className="card p-8 space-y-4">
          <p className="section-kicker">Authentication</p>
          <h1 className="section-title">Sign-in failed</h1>
          <p className="text-sm text-muted">{error}</p>
          <Link href="/login" className="btn-primary inline-flex">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card p-8 text-center">
        <div className="h-12 w-12 rounded-full border-2 border-line border-t-accent animate-spin mx-auto mb-4"></div>
        <p className="section-kicker">Authentication</p>
        <h1 className="section-title mt-2">Finalizing sign-in</h1>
      </div>
    </div>
  );
}
