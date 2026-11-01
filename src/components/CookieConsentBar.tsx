import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateUserPrivacySettings } from '../lib/firestoreRepo';

const CONSENT_KEY = 'fanzeum_cookie_consent';

export const CookieConsentBar: React.FC = () => {
  const { firebaseUser, profile } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = window.localStorage.getItem(CONSENT_KEY);
    if (existing) return;
    // Respect >= 10s dwell rule so first page load never shows an arrival popup
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
      className="fixed bottom-0 inset-x-0 z-30 border-t border-stone-200 dark:border-stone-800 bg-[#FBF9F5]/95 dark:bg-[#171614]/95 backdrop-blur-sm px-4 py-3"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
          Fanzeum uses strictly necessary cookies for authentication and UK GDPR preferences, plus optional gallery analytics.{' '}
          <Link to="/privacy" className="underline hover:text-[#9A3412] dark:hover:text-[#D97757]">
            Privacy &amp; Data Centre
          </Link>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleChoice('essential')}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-300 dark:border-stone-700 text-[#1C1917] dark:text-[#F5F2EB] hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={() => handleChoice('all')}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            Accept All
          </button>
        </div>
      </div>
    </aside>
  );
};
