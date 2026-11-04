import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';

export const ReAuthModal: React.FC = () => {
  const { reAuthPromptOpen, confirmReAuth, cancelReAuth } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reAuthPromptOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await confirmReAuth(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={reAuthPromptOpen}
      onClose={cancelReAuth}
      title="Security Check: Confirm Password"
      subtitle="For your protection, sensitive actions require recent sign-in within the last 5 minutes."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-muted" strokeWidth={1.5} />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your account password"
            className="w-full min-h-[44px] pl-11 pr-3.5 py-2.5 text-base rounded-xl border border-border bg-bg text-ink placeholder:text-muted/60"
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={cancelReAuth}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !password}>
            {busy ? 'Confirming…' : 'Confirm Password'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
};
