import { usePWA } from '@/hooks/usePWA';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator = () => {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 bg-warning text-warning-foreground px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium shadow-md"
    >
      <WifiOff size={16} aria-hidden="true" />
      <span>Você está offline</span>
    </div>
  );
};
