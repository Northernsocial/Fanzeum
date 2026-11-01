import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Download,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  removeDemoDataFromFirestore,
  seedDemoDataToFirestore,
} from '../../lib/demoSeeder';
import {
  exportAllUserData,
  updateUserPrivacySettings,
  updateUserPublicProfile,
} from '../../lib/firestoreRepo';
import { useDocumentMeta } from '../../components/DocumentMeta';
import { PWAInstallButton } from '../../components/PWAInstallButton';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Sheet } from '../../components/ui/Sheet';

export const SettingsPage: React.FC = () => {
  const {
    firebaseUser,
    profile,
    privateAccount,
    isAdminUser,
    openAuthModal,
    refreshProfile,
    signOut,
    deleteAccountAndData,
  } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  useDocumentMeta({
    title: 'Settings & UK GDPR Privacy',
    description: 'Manage your cabinet visibility, lighting theme, JSON data export, and account controls.',
  });

  const [busyExport, setBusyExport] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmWord, setConfirmWord] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // Admin demo seeder state
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminProgress, setAdminProgress] = useState<string | null>(null);

  const togglePublicPref = async (
    key: 'isPublicProfile' | 'hideValues' | 'hideLocation',
    next: boolean,
  ) => {
    if (!firebaseUser?.emailVerified) return;
    await updateUserPublicProfile(firebaseUser.uid, { [key]: next });
    await refreshProfile();
  };

  const togglePrivatePref = async (
    key: 'analyticsConsent' | 'marketingConsent' | 'aiTrainingOptOut',
    next: boolean,
  ) => {
    if (!firebaseUser?.emailVerified) return;
    await updateUserPrivacySettings(firebaseUser.uid, { [key]: next });
    await refreshProfile();
  };

  const handleDownloadJson = async () => {
    if (!firebaseUser?.emailVerified) return;
    setBusyExport(true);
    setStatusNote(null);
    try {
      const payload = await exportAllUserData(firebaseUser.uid);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fanzeum-export-${profile?.handle || 'collector'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatusNote('Downloaded your full JSON data package.');
    } finally {
      setBusyExport(false);
    }
  };

  const handleDeleteEverything = async () => {
    setDeletingAccount(true);
    setStatusNote(null);
    try {
      await deleteAccountAndData();
      setDeleteOpen(false);
      navigate('/');
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('requires-recent-login')) {
        setStatusNote(
          'For security, sign out and sign right back in before permanently deleting your account.',
        );
      } else {
        setStatusNote(raw);
      }
      setDeleteOpen(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleSeedDemo = async () => {
    setAdminBusy(true);
    try {
      const res = await seedDemoDataToFirestore((msg) => setAdminProgress(msg));
      setAdminProgress(
        `Loaded ${res.users} collectors, ${res.collections} collections, and ${res.items} pieces into Firestore.`,
      );
    } catch (err) {
      setAdminProgress(err instanceof Error ? err.message : 'Seed failed.');
    } finally {
      setAdminBusy(false);
    }
  };

  const handleRemoveDemo = async () => {
    setAdminBusy(true);
    try {
      const res = await removeDemoDataFromFirestore((msg) => setAdminProgress(msg));
      setAdminProgress(`Removed ${res.deletedCount} demo documents and hid built-in demo catalogue.`);
    } catch (err) {
      setAdminProgress(err instanceof Error ? err.message : 'Remove demo failed.');
    } finally {
      setAdminBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-ink">
          Settings &amp; Privacy
        </h1>
        <p className="text-base text-muted">
          Lighting theme, cabinet privacy, UK GDPR data portability, and account controls.
        </p>
      </div>

      {/* Gallery Appearance & Install */}
      <Card className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-semibold text-ink">Cabinet lighting</h2>
            <p className="text-sm text-muted mt-0.5">
              After Hours dark mode lets slabs, coins, and sleeves take centre stage.
            </p>
          </div>
          <div className="inline-flex items-center gap-2">
            <Button
              variant={theme === 'dark' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTheme('dark')}
            >
              <Moon className="w-4 h-4" strokeWidth={1.5} />
              <span>After Hours</span>
            </Button>
            <Button
              variant={theme === 'light' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTheme('light')}
            >
              <Sun className="w-4 h-4" strokeWidth={1.5} />
              <span>Daylight</span>
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted">
            Install Fanzeum as an app on your phone or desktop for instant camera access.
          </div>
          <PWAInstallButton />
        </div>
      </Card>

      {/* Signed-in Collector Controls */}
      {firebaseUser && profile ? (
        <>
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-display font-semibold text-ink">
                  Cabinet visibility (@{profile.handle})
                </h2>
                <p className="text-sm text-muted mt-0.5">
                  Signed in as {privateAccount?.email || firebaseUser.email}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
                <span>Sign out</span>
              </Button>
            </div>

            <div className="divide-y divide-border">
              <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-base font-medium text-ink">Public @handle cabinet</div>
                  <div className="text-sm text-muted">
                    Allow anyone with your link to view your public collections.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={profile.isPublicProfile}
                  onChange={(e) => void togglePublicPref('isPublicProfile', e.target.checked)}
                  className="w-5 h-5 accent-brass shrink-0"
                />
              </label>

              <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-base font-medium text-ink">
                    Hide £ estimates from visitors
                  </div>
                  <div className="text-sm text-muted">
                    Keep £ values visible to you while hiding them on public pages.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={profile.hideValues}
                  onChange={(e) => void togglePublicPref('hideValues', e.target.checked)}
                  className="w-5 h-5 accent-brass shrink-0"
                />
              </label>

              <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-base font-medium text-ink">Hide town / county</div>
                  <div className="text-sm text-muted">
                    Never display your town or county on your public profile.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={profile.hideLocation}
                  onChange={(e) => void togglePublicPref('hideLocation', e.target.checked)}
                  className="w-5 h-5 accent-brass shrink-0"
                />
              </label>
            </div>
          </Card>

          {/* UK GDPR Data Rights */}
          <Card className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-brass shrink-0 mt-0.5" strokeWidth={1.5} />
              <div>
                <h2 className="text-xl font-display font-semibold text-ink">
                  UK GDPR &amp; Data Protection Act 2018
                </h2>
                <p className="text-sm text-muted mt-0.5 leading-relaxed">
                  Your email address and private purchase prices live in a locked private Vault
                  subcollection that other users cannot read. Every uploaded photo has GPS/EXIF
                  metadata stripped on your device before upload.
                </p>
              </div>
            </div>

            {privateAccount && (
              <div className="divide-y divide-border">
                <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <div className="text-base font-medium text-ink">Anonymous usage analytics</div>
                    <div className="text-sm text-muted">
                      Help us spot broken flows without sharing personal data.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={privateAccount.analyticsConsent}
                    onChange={(e) =>
                      void togglePrivatePref('analyticsConsent', e.target.checked)
                    }
                    className="w-5 h-5 accent-brass shrink-0"
                  />
                </label>

                <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <div className="text-base font-medium text-ink">
                      Opt out of AI model training
                    </div>
                    <div className="text-sm text-muted">
                      Mark your cabinet photos and notes as excluded from future training sets.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={privateAccount.aiTrainingOptOut}
                    onChange={(e) =>
                      void togglePrivatePref('aiTrainingOptOut', e.target.checked)
                    }
                    className="w-5 h-5 accent-brass shrink-0"
                  />
                </label>
              </div>
            )}

            <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-4">
              <Button variant="secondary" disabled={busyExport} onClick={handleDownloadJson}>
                <Download className="w-4 h-4" strokeWidth={1.5} />
                <span>{busyExport ? 'Preparing JSON…' : 'Download all my data (JSON)'}</span>
              </Button>

              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                <span>Delete account &amp; photos</span>
              </Button>
            </div>

            {statusNote && <p className="text-sm text-brass">{statusNote}</p>}
          </Card>

          {/* Admin-Only Demo Seeder (fifestreet@gmail.com) */}
          {isAdminUser && (
            <Card raised className="p-6 space-y-4 border-brass/50">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-brass" strokeWidth={1.5} />
                <h2 className="text-xl font-display font-semibold text-ink">
                  Admin Demo Controls
                </h2>
              </div>
              <p className="text-sm text-muted">
                Seed the 6 UK demo collectors, 16 collections, and 192 pieces directly into
                Firestore (idempotent—safe to run multiple times), or remove all demo records in
                one click.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={adminBusy} onClick={handleSeedDemo}>
                  Load demo data (192 pieces)
                </Button>
                <Button variant="danger" disabled={adminBusy} onClick={handleRemoveDemo}>
                  Remove demo data
                </Button>
              </div>
              {adminProgress && (
                <p className="text-xs font-mono text-brass">{adminProgress}</p>
              )}
            </Card>
          )}
        </>
      ) : (
        <Card className="p-6 sm:p-8 space-y-4">
          <h2 className="text-xl font-display font-semibold text-ink">
            Collector account &amp; UK GDPR rights
          </h2>
          <p className="text-base text-muted leading-relaxed">
            Sign in to manage your public @handle, hide £ valuations, download a complete JSON
            copy of your cabinet, or permanently erase your account and cloud photos at any time.
          </p>
          <div>
            <Button onClick={openAuthModal}>Sign in to manage account</Button>
          </div>
        </Card>
      )}

      {/* Permanent Account Erasure Sheet */}
      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account and all photos?"
        subtitle="Right to Erasure (UK GDPR). This wipes your Storage photos, private records, collections, pieces, and login."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Type <strong className="font-mono text-ink">DELETE</strong> below to confirm permanent
            erasure.
          </p>
          <input
            type="text"
            value={confirmWord}
            onChange={(e) => setConfirmWord(e.target.value)}
            placeholder="Type DELETE"
            className="w-full min-h-[44px] px-3.5 py-2 text-base font-mono rounded-xl border border-border bg-bg text-ink"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={confirmWord.trim() !== 'DELETE' || deletingAccount}
              onClick={handleDeleteEverything}
            >
              {deletingAccount ? 'Erasing everything…' : 'Delete everything permanently'}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
};
