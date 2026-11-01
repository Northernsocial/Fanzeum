import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateUserPrivacySettings } from '../lib/firestoreRepo';
import { Button } from './ui/Button';

const CONSENT_KEY = 'fanzeum_cookie_consent';

export const CookieConsentBar: React.FC = () => {
  const { firebaseUser, profile } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = window.localStorage.getItem(CONSENT_KEY);
    if (existing) return;
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 10500);
    return () => window.clearTimeout(timer);
  }, []);

  const handleChoice = async (choice: 'essential' | 'all') => {
    window.localStorage.setItem(CONSENT_KEY, choice);
    setVisible(false);
    if (firebaseUser?.emailVerified && profile) {
      try {
        await updateUserPrivacySettings(firebaseUser.uid, {
          analyticsConsent: choice === 'all',
        });
      } catch {
        // Non-blocking consent sync
      }
    }
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Cookie preferences"
      className="fixed bottom-16 md:bottom-0 inset-x-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md px-4 py-3"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-sm text-muted leading-relaxed">
          Fanzeum uses essential cookies to keep you signed in and remember your UK GDPR choices, plus optional anonymous usage stats.{' '}
          <Link to="/privacy" className="underline text-ink hover:text-brass">
            Privacy &amp; Data
          </Link>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => handleChoice('essential')}>
            Essential only
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleChoice('all')}>
            Accept all
          </Button>
        </div>
      </div>
    </aside>
  );
};
