import React, { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getFriendlyFirebaseErrorMessage } from '../lib/firebase';
import {
  FANZEUM_LOGO_ALT,
  FANZEUM_LOGO_SRC,
} from '../lib/brand';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';
import { Tabs } from './ui/Tabs';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    needsEmailVerification,
    resendVerificationEmail,
    refreshVerificationStatus,
    signOut,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleGoogle = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign-in error:', err);
      const friendly = getFriendlyFirebaseErrorMessage(err);
      if (friendly === 'Something went wrong. Please try again.') {
        setErrorMessage('Google sign-in could not be completed. Please try again.');
      } else {
        setErrorMessage(friendly);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(displayName, email, password);
        setStatusMessage('Verification link sent. Check your inbox to activate your showcase.');
      }
    } catch (err) {
      console.error('Email auth error:', err);
      const friendly = getFriendlyFirebaseErrorMessage(err);
      if (friendly === 'Something went wrong. Please try again.') {
        setErrorMessage(mode === 'signin' ? 'Could not sign in with email. Please try again.' : 'Could not create account. Please try again.');
      } else {
        setErrorMessage(friendly);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {needsEmailVerification && (
        <div className="bg-surface-raised border-b border-brass/40 px-4 py-3">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2.5 text-ink font-medium">
              <MailCheck className="w-4 h-4 text-brass shrink-0" strokeWidth={1.5} />
              <span>Check your inbox to verify your email</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const ok = await refreshVerificationStatus();
                  if (!ok) {
                    setStatusMessage('Still waiting for email verification. Click the link in your inbox first.');
                  } else {
                    setStatusMessage('Email verified! Your showcase is ready.');
                  }
                }}
              >
                I&apos;ve verified
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await resendVerificationEmail();
                  setStatusMessage('Sent a fresh verification email.');
                }}
              >
                Resend
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
          {statusMessage && (
            <p className="max-w-6xl mx-auto text-xs text-brass mt-1">{statusMessage}</p>
          )}
        </div>
      )}

      <Sheet
        open={authModalOpen}
        onClose={closeAuthModal}
        title={mode === 'signin' ? 'Sign in to your showcase' : 'Start your collector showcase'}
        subtitle="Add pieces by photo, check realistic UK £ values, and exhibit your sets."
      >
        <div className="space-y-5">
          <div className="flex justify-center">
            <img
              src={FANZEUM_LOGO_SRC}
              alt={FANZEUM_LOGO_ALT}
              className="h-12 w-auto object-contain"
              loading="eager"
            />
          </div>

          <Button variant="primary" fullWidth disabled={busy} onClick={handleGoogle}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 1.81-1.5 3.34-3.2 4.37v3.62h5.18c3.03-2.79 4.78-6.9 4.78-11.78 0-.8-.08-1.57-.22-2.31l.12.37z"
              />
              <path
                fill="currentColor"
                opacity="0.75"
                d="M12.18 22c4.32 0 7.95-1.43 10.6-3.88l-5.18-3.62c-1.43.96-3.27 1.53-5.42 1.53-4.17 0-7.7-2.81-8.96-6.6H-2.1v3.73C.54 18.4 5.94 22 12.18 22z"
              />
            </svg>
            <span>Continue with Google</span>
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted">or use email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="flex justify-center">
            <Tabs
              ariaLabel="Account mode"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setErrorMessage(null);
              }}
              options={[
                { value: 'signin', label: 'Sign in' },
                { value: 'register', label: 'Create account' },
              ]}
            />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Your collector name
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Dez Murphy"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-base rounded-xl border border-border bg-bg text-ink placeholder:text-muted/60"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.co.uk"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-base rounded-xl border border-border bg-bg text-ink placeholder:text-muted/60"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-base rounded-xl border border-border bg-bg text-ink placeholder:text-muted/60"
              />
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="text-sm leading-relaxed p-3 rounded-xl border border-danger/40 bg-danger/10 text-danger"
              >
                {errorMessage}
              </p>
            )}

            <Button type="submit" variant="secondary" fullWidth disabled={busy}>
              {busy
                ? 'Working…'
                : mode === 'signin'
                  ? 'Sign in with email'
                  : 'Create account & send verification'}
            </Button>
          </form>
        </div>
      </Sheet>
    </>
  );
};
