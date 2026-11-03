import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl bg-surface-raised text-ink px-3.5 py-2 text-xs font-medium border border-brass/50 shadow-lg"
    >
      <WifiOff className="w-4 h-4 text-brass shrink-0" strokeWidth={1.5} />
      <span>Offline — showing cached showcases</span>
    </div>
  );
};
