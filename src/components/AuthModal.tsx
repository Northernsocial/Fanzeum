import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleGoogle = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in could not be completed.';
      setErrorMessage(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMessage(null);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(displayName, email, password);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('auth/operation-not-allowed')) {
        setErrorMessage(
          'Email/Password sign-in is not yet enabled on this Firebase project. Use Continue with Google right away, or enable Email/Password in Firebase Console > Authentication > Sign-in method.',
        );
      } else if (raw.includes('auth/invalid-credential')) {
        setErrorMessage('Incorrect email or password. Please check your credentials and try again.');
      } else {
        setErrorMessage(raw);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-[#FBF9F5] dark:bg-[#171614] border border-stone-200 dark:border-stone-800 p-6 sm:p-8 shadow-2xl relative">
        <button
          type="button"
          onClick={closeAuthModal}
          aria-label="Close sign-in modal"
          className="absolute top-5 right-5 p-2 rounded-lg text-stone-500 hover:text-[#1C1917] dark:hover:text-[#F5F2EB] hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
          Collector &amp; Curator Access
        </p>
        <h2
          id="auth-modal-title"
          className="mt-1 text-2xl sm:text-3xl font-serif font-semibold text-[#1C1917] dark:text-[#F5F2EB]"
        >
          {mode === 'signin' ? 'Enter Your Cabinet' : 'Create Collector Account'}
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          Sign in to curate exhibitions, identify items by photograph, and track valuations in £ GBP.
        </p>

        {/* Primary Google Sign-In */}
        <button
          type="button"
          disabled={busy}
          onClick={handleGoogle}
          className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
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
          Continue with Google (Instant Verified Access)
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          <span className="text-xs text-stone-400">or email &amp; password</span>
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
        </div>

        {/* Segmented mode selector */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-stone-200/70 dark:bg-stone-800/80 mb-4">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              mode === 'signin'
                ? 'bg-white dark:bg-[#171614] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-white dark:bg-[#171614] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Public Curator Name
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g.Clara Whitfield"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB] focus:outline-none focus:border-[#9A3412]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="curator@example.co.uk"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="text-xs leading-relaxed p-3 rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 px-4 rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            {busy
              ? 'Authenticating…'
              : mode === 'signin'
                ? 'Sign In with Email'
                : 'Create Account & Send Verification'}
          </button>
        </form>
      </div>
    </div>
  );
};
