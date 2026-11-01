/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { CookieConsentBar } from './components/CookieConsentBar';
import { HomePage } from './pages/HomePage';

const ExhibitionPage = lazy(() =>
  import('./pages/ExhibitionPage').then((m) => ({ default: m.ExhibitionPage })),
);
const CuratorsPage = lazy(() =>
  import('./pages/CuratorsPage').then((m) => ({ default: m.CuratorsPage })),
);
const CollectorProfilePage = lazy(() =>
  import('./pages/CollectorProfilePage').then((m) => ({ default: m.CollectorProfilePage })),
);
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
);
const StudioPage = lazy(() =>
  import('./pages/StudioPage').then((m) => ({ default: m.StudioPage })),
);
const PrivacyCentrePage = lazy(() =>
  import('./pages/PrivacyCentrePage').then((m) => ({ default: m.PrivacyCentrePage })),
);

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error && parsed?.operationType) {
        readable = `Database access check (${parsed.operationType} on ${parsed.path || 'record'}): ${parsed.error}`;
      }
    } catch {
      // Standard error string
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#FBF9F5] dark:bg-[#0F0E0D] text-[#1C1917] dark:text-[#F5F2EB]">
          <div className="max-w-md w-full p-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171614] space-y-4">
            <h1 className="text-2xl font-serif font-semibold">Gallery Interrupted</h1>
            <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
              className="px-4 py-2 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] text-xs font-medium cursor-pointer"
            >
              Return to Exhibitions
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917] dark:bg-[#0F0E0D] dark:text-[#F5F2EB] transition-colors duration-200">
              <Header />

              <main className="flex-1">
                <Suspense
                  fallback={
                    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
                      <div className="h-48 rounded-xl bg-stone-100 dark:bg-stone-900 animate-pulse" />
                    </div>
                  }
                >
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/exhibition/:collectionId" element={<ExhibitionPage />} />
                    <Route path="/curators" element={<CuratorsPage />} />
                    <Route path="/collector/:uid" element={<CollectorProfilePage />} />
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/studio" element={<StudioPage />} />
                    <Route path="/privacy" element={<PrivacyCentrePage />} />
                  </Routes>
                </Suspense>
              </main>

              <footer className="border-t border-stone-200 dark:border-stone-800 py-10 px-5 sm:px-8">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-500 dark:text-stone-400">
                  <div>
                    <span className="font-serif text-base font-semibold text-[#1C1917] dark:text-[#F5F2EB] mr-3">
                      Fanzeum
                    </span>
                    <span>
                      Curate, exhibit, identify, and value collections. UK GDPR compliant.
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-5">
                    <Link to="/" className="hover:text-[#1C1917] dark:hover:text-[#F5F2EB]">
                      Exhibitions
                    </Link>
                    <Link to="/curators" className="hover:text-[#1C1917] dark:hover:text-[#F5F2EB]">
                      Curators
                    </Link>
                    <Link to="/onboarding" className="hover:text-[#1C1917] dark:hover:text-[#F5F2EB]">
                      AI Guide
                    </Link>
                    <Link to="/privacy" className="hover:text-[#1C1917] dark:hover:text-[#F5F2EB]">
                      Privacy &amp; Data Export
                    </Link>
                  </div>
                </div>
              </footer>

              <AuthModal />
              <OfflineIndicator />
              <CookieConsentBar />
            </div>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
