import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { exportAllUserData, updateUserPrivacySettings } from '../lib/firestoreRepo';

export const PrivacyCentrePage: React.FC = () => {
  const {
    firebaseUser,
    privateAccount,
    openAuthModal,
    refreshProfile,
    deleteAccountAndData,
  } = useAuth();
  const navigate = useNavigate();

  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [aiTrainingOptOut, setAiTrainingOptOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (privateAccount) {
      setAnalyticsConsent(privateAccount.analyticsConsent);
      setMarketingConsent(privateAccount.marketingConsent);
      setAiTrainingOptOut(privateAccount.aiTrainingOptOut);
    } else {
      const localCookie = window.localStorage.getItem('fanzeum_cookie_consent');
      setAnalyticsConsent(localCookie === 'all');
    }
  }, [privateAccount]);

  const handleSavePreferences = async () => {
    setSaving(true);
    setStatusMessage(null);
    window.localStorage.setItem(
      'fanzeum_cookie_consent',
      analyticsConsent ? 'all' : 'essential',
    );
    try {
      if (firebaseUser?.emailVerified && privateAccount) {
        await updateUserPrivacySettings(firebaseUser.uid, {
          analyticsConsent,
          marketingConsent,
          aiTrainingOptOut,
        });
        await refreshProfile();
      }
      setStatusMessage('Your UK GDPR privacy preferences have been saved.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Unable to save privacy preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!firebaseUser?.emailVerified) return;
    setExporting(true);
    setStatusMessage(null);
    try {
      const bundle = await exportAllUserData(firebaseUser.uid);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fanzeum-gdpr-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage('Full machine-readable JSON data archive downloaded.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Could not export data.');
    } finally {
      setExporting(false);
    }
  };

  const handlePermanentDelete = async () => {
    setDeleting(true);
    setStatusMessage(null);
    try {
      await deleteAccountAndData();
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('requires-recent-login')) {
        setStatusMessage(
          'For your security, Firebase requires a fresh sign-in before deleting an account. Please sign out, sign back in, and retry.',
        );
      } else {
        setStatusMessage(msg);
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12 pb-20 space-y-10">
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6">
        <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
          UK GDPR &amp; Data Protection Act 2018
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
          Privacy &amp; Data Stewardship Centre
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl leading-relaxed">
          Fanzeum isolates your personal account email and consent records inside a restricted private subcollection that is never readable by other collectors or public visitors.
        </p>
      </div>

      {statusMessage && (
        <p className="text-xs p-3.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171614] text-[#1C1917] dark:text-[#F5F2EB]">
          {statusMessage}
        </p>
      )}

      {/* Cookie & Processing Controls */}
      <section className="p-6 sm:p-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#9A3412] dark:text-[#D97757]" />
          <h2 className="text-xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
            Cookie &amp; Processing Preferences
          </h2>
        </div>

        <div className="divide-y divide-stone-200 dark:divide-stone-800 text-sm">
          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-[#1C1917] dark:text-[#F5F2EB]">
                Strictly Necessary Gallery &amp; Authentication Cookies
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Required for secure Firebase sign-in, session protection, and theme lighting state.
              </div>
            </div>
            <span className="text-xs font-mono text-stone-500">Always Active</span>
          </div>

          <label className="py-4 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="font-medium text-[#1C1917] dark:text-[#F5F2EB]">
                Optional Exhibition Analytics
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Helps measure exhibition readership without cross-site advertising trackers.
              </div>
            </div>
            <input
              type="checkbox"
              checked={analyticsConsent}
              onChange={(e) => setAnalyticsConsent(e.target.checked)}
              className="w-4 h-4 accent-[#9A3412]"
            />
          </label>

          <label className="py-4 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="font-medium text-[#1C1917] dark:text-[#F5F2EB]">
                Curatorial Digest &amp; Collector Updates
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Occasional dispatches on featured UK exhibitions and set alerts.
              </div>
            </div>
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="w-4 h-4 accent-[#9A3412]"
            />
          </label>

          <label className="py-4 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="font-medium text-[#1C1917] dark:text-[#F5F2EB]">
                Opt Out of AI Cataloguing Dataset Review
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Keep your uploaded item photographs strictly excluded from future model evaluation.
              </div>
            </div>
            <input
              type="checkbox"
              checked={aiTrainingOptOut}
              onChange={(e) => setAiTrainingOptOut(e.target.checked)}
              className="w-4 h-4 accent-[#9A3412]"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSavePreferences}
          className="px-5 py-2.5 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] text-xs font-medium cursor-pointer"
        >
          {saving ? 'Saving Preferences…' : 'Save Privacy Preferences'}
        </button>
      </section>

      {/* Data Portability & Right to Erasure */}
      <section className="p-6 sm:p-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] space-y-5">
        <h2 className="text-xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
          Subject Access Export &amp; Right to Erasure
        </h2>

        {!firebaseUser ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Sign in to download a complete portable JSON archive of your Fanzeum records or permanently erase your account.
            </p>
            <button
              type="button"
              onClick={openAuthModal}
              className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium cursor-pointer"
            >
              Sign In to Manage Account Data
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200 dark:border-stone-800">
              <div>
                <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EB]">
                  Download Complete Personal Archive (JSON)
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Includes your public profile, isolated private consent record ({privateAccount?.email || firebaseUser.email}), collections, and item accessions.
                </div>
              </div>
              <button
                type="button"
                disabled={exporting || !firebaseUser.emailVerified}
                onClick={handleExportData}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {exporting ? 'Preparing Archive…' : 'Export My Data'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-red-700 dark:text-red-400">
                  Delete Account &amp; Erase All Records
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Permanently deletes your items, collections, private account data, and Firebase Authentication login.
                </div>
              </div>

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 dark:border-red-900 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Account
                </button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handlePermanentDelete}
                    className="px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-medium hover:bg-red-800 disabled:opacity-50 cursor-pointer"
                  >
                    {deleting ? 'Erasing…' : 'Confirm Permanent Erasure'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
