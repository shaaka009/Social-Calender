import { router, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ensureValidSession } from './api';

const PUBLIC_SEGMENTS = new Set([
  'welcome',
  '(auth)',
  'onboarding',
  'reset-password',
  'verify-email',
]);

/**
 * Redirect unauthenticated users away from protected routes.
 * Splash (`index`) handles its own session check.
 */
export default function useRequireAuth() {
  const segments = useSegments();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const root = segments[0];

    // Splash route manages its own redirect.
    if (!root || root === 'index') {
      setChecking(false);
      return undefined;
    }

    if (PUBLIC_SEGMENTS.has(root)) {
      setChecking(false);
      return undefined;
    }

    (async () => {
      const ok = await ensureValidSession();
      if (cancelled) return;
      if (!ok) {
        router.replace('/welcome');
      }
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [segments]);

  return checking;
}
