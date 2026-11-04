import React, { useState } from 'react';
import { Shield, KeyRound, Smartphone, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Sheet } from './ui/Sheet';

export const SecuritySettingsSection: React.FC = () => {
  const { profile, twoFactorRecord, enrol2fa, disable2fa, recoveryCodesList, refreshProfile } = useAuth();
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMandatory = Boolean(profile?.plan !== 'free' || profile?.role === 'admin' || profile?.isVerifiedExpert);

  const handleEnrol = async () => {
    setBusy(true);
    setError(null);
    try {
      await enrol2fa();
      setSetupModalOpen(false);
      setRecoveryModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable 2FA.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (isMandatory) {
      setError('2FA is mandatory for your account tier or role.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await disable2fa();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable 2FA.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-brass shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <h2 className="text-xl font-display font-semibold text-ink">Account Security &amp; 2FA</h2>
            <p className="text-sm text-muted mt-0.5 leading-relaxed">
              Protect your showcase and valuations with time-based one-time passwords (TOTP) via authenticator apps like Google Authenticator or 1Password.
            </p>
          </div>
        </div>
        {twoFactorRecord?.enabled ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>2FA Active</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Not Enabled</span>
          </span>
        )}
      </div>

      {isMandatory && !twoFactorRecord?.enabled && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>2FA Required:</strong> As a verified expert, store, or Collector Plus member, two-factor authentication is mandatory to safeguard your showcase.
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
        <div className="text-sm text-muted">
          {twoFactorRecord?.enabled
            ? 'Your authenticator app is paired and securing sensitive actions.'
            : 'Enrol an authenticator app to enable 2FA verification.'}
        </div>
        <div className="flex items-center gap-2">
          {twoFactorRecord?.enabled ? (
            <Button variant="danger" size="sm" disabled={busy || isMandatory} onClick={handleDisable}>
              Disable 2FA
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => setSetupModalOpen(true)}>
              Enrol Authenticator App
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Setup 2FA Sheet */}
      <Sheet
        open={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        title="Enrol Authenticator App"
        subtitle="Scan the secret or enter setup key in your authenticator app."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
            <div className="text-xs text-muted font-mono uppercase tracking-wider">Secret Setup Key</div>
            <div className="text-lg font-mono font-bold text-ink tracking-widest bg-bg p-3 rounded-lg border border-border select-all">
              JBSWY3DPEHPK3PXP
            </div>
            <p className="text-xs text-muted">
              Enter this key into Google Authenticator, Authy, or 1Password if you cannot scan a QR code.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setSetupModalOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={handleEnrol}>
              {busy ? 'Enrolling…' : 'Confirm & Generate Recovery Codes'}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Recovery Codes Sheet */}
      <Sheet
        open={recoveryModalOpen}
        onClose={() => {
          setRecoveryModalOpen(false);
          void refreshProfile();
        }}
        title="Save Your Recovery Codes"
        subtitle="These codes are shown only once. Store them securely in case you lose your device."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
            {recoveryCodesList.map((code, idx) => (
              <div key={idx} className="font-mono text-sm text-ink bg-bg p-2 rounded border border-border select-all">
                {code}
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-500">
            Warning: If you lose your authenticator device and recovery codes, your showcase cannot be recovered.
          </p>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setRecoveryModalOpen(false);
                void refreshProfile();
              }}
            >
              I have saved these codes
            </Button>
          </div>
        </div>
      </Sheet>
    </Card>
  );
};
