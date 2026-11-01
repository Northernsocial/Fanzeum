import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] px-3.5 py-2 text-xs font-medium shadow-md border border-stone-700 dark:border-stone-300"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Archive Mode — Viewing cached gallery records</span>
    </div>
  );
};
