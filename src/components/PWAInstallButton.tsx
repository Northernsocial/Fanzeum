import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <Button variant="secondary" size="sm" onClick={install}>
        <Download className="w-4 h-4 text-brass" strokeWidth={1.5} />
        <span>Install app</span>
      </Button>
    );
  }

  if (isIOS) {
    return (
      <>
        <Button variant="secondary" size="sm" onClick={() => setShowIOSGuide(true)}>
          <Download className="w-4 h-4 text-brass" strokeWidth={1.5} />
          <span>Add to Home Screen</span>
        </Button>

        <Sheet
          open={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          title="Install Fanzeum on iPhone or iPad"
          subtitle="Keep your cabinet one tap away on your Home Screen."
        >
          <ol className="space-y-3 text-base text-muted list-decimal list-inside">
            <li>
              Tap the <strong className="text-ink">Share</strong> button in your Safari toolbar.
            </li>
            <li>
              Scroll down and choose <strong className="text-ink">Add to Home Screen</strong>.
            </li>
          </ol>
          <div className="mt-6">
            <Button fullWidth onClick={() => setShowIOSGuide(false)}>
              Got it
            </Button>
          </div>
        </Sheet>
      </>
    );
  }

  return null;
};
