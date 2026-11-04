import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';

export const TwoFactorModal: React.FC = () => {
  const { twoFactorPromptOpen, verifyAndComplete2fa, cancel2faPrompt } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!twoFactorPromptOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyAndComplete2fa(code);
      if (!ok) {
        setError('Invalid 6-digit TOTP code or recovery code. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={twoFactorPromptOpen}
      onClose={cancel2faPrompt}
      title="Two-Factor Authentication Required"
      subtitle="Enter the 6-digit code from your authenticator app or an 8-character recovery code."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-3.5 w-5 h-5 text-muted" strokeWidth={1.5} />
          <input
            type="text"
            required
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            placeholder="e.g. 483920 or recovery code"
            className="w-full min-h-[44px] pl-11 pr-3.5 py-2.5 text-lg font-mono tracking-wider rounded-xl border border-border bg-bg text-ink placeholder:text-muted/60"
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={cancel2faPrompt}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !code}>
            {busy ? 'Verifying…' : 'Verify & Continue'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
};
