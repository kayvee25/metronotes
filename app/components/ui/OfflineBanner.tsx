'use client';

import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div role="status" className="bg-amber-600 text-white text-xs text-center py-1.5 px-4 font-medium">
      You&apos;re offline — showing cached content
    </div>
  );
}
