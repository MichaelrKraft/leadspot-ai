'use client';

import { useState, useEffect } from 'react';

interface TenantConfig {
  mauticUrl: string;
  isLoading: boolean;
}

/**
 * React hook for accessing tenant Mautic URL in client components.
 * Falls back to NEXT_PUBLIC_MAUTIC_URL if API call fails.
 */
export function useTenantMauticUrl(): TenantConfig {
  const [mauticUrl, setMauticUrl] = useState<string>(
    process.env.NEXT_PUBLIC_MAUTIC_URL ?? ''
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tenant/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.mauticUrl) {
          setMauticUrl(data.mauticUrl);
        }
      })
      .catch(() => {
        // Fall back to env var — already set as default state
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { mauticUrl, isLoading };
}
