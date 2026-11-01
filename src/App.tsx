/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthModal } from './components/AuthModal';
import { CookieConsentBar } from './components/CookieConsentBar';
import { Header } from './components/Header';
import { MobileTabBar } from './components/MobileTabBar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Button } from './components/ui/Button';
import { EmptyState, Skeleton } from './components/ui/EmptyState';
import { HomePage } from './features/home/HomePage';

const ExplorePage = lazy(() =>
  import('./features/explore/ExplorePage').then((m) => ({ default: m.ExplorePage })),
);
const CabinetPage = lazy(() =>
  import('./features/cabinet/CabinetPage').then((m) => ({ default: m.CabinetPage })),
);
const CollectionPage = lazy(() =>
  import('./features/collections/CollectionPage').then((m) => ({ default: m.CollectionPage })),
);
const ItemPage = lazy(() =>
  import('./features/items/ItemPage').then((m) => ({ default: m.ItemPage })),
);
const AddPiecePage = lazy(() =>
  import('./features/add/AddPiecePage').then((m) => ({ default: m.AddPiecePage })),
);
const OnboardingPage = lazy(() =>
  import('./features/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
);
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

const LegacyExhibitionRedirect: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  return <Navigate to={collectionId ? `/c/${collectionId}` : '/explore'} replace />;
};

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
        readable = `Permission check (${parsed.operationType} on ${parsed.path || 'record'}): ${parsed.error}`;
      }
    } catch {
      // Standard error string
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-bg text-ink">
          <div className="max-w-md w-full p-8 rounded-2xl border border-border bg-surface space-y-4">
            <h1 className="text-2xl font-display font-semibold">Something went sideways</h1>
            <p className="text-sm text-muted leading-relaxed">{this.state.message}</p>
            <Button
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
            >
              Back to Home
            </Button>
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
            <div className="min-h-screen flex flex-col bg-bg text-ink transition-colors duration-200">
              <Header />
              <AuthModal />

              <main className="flex-1">
                <Suspense
                  fallback={
                    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-6">
                      <Skeleton className="h-44" />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <Skeleton className="h-80" />
                        <Skeleton className="h-80" />
                        <Skeleton className="h-80" />
                      </div>
                    </div>
                  }
                >
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/explore" element={<ExplorePage />} />
                    <Route path="/c/:collectionId" element={<CollectionPage />} />
                    <Route path="/exhibition/:collectionId" element={<LegacyExhibitionRedirect />} />
                    <Route path="/i/:itemId" element={<ItemPage />} />
                    <Route path="/add" element={<AddPiecePage />} />
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/privacy" element={<SettingsPage />} />
                    <Route path="/u/:handle" element={<CabinetPage />} />
                    <Route path="/:atHandle" element={<CabinetPage />} />
                    <Route
                      path="*"
                      element={
                        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16">
                          <EmptyState
                            title="Page not found"
                            description="That cabinet, collection, or piece URL does not exist."
                            action={
                              <Link to="/explore">
                                <Button>Explore pieces</Button>
                              </Link>
                            }
                          />
                        </div>
                      }
                    />
                  </Routes>
                </Suspense>
              </main>

              <footer className="hidden md:block border-t border-border py-10 px-4 sm:px-8">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted">
                  <div>
                    <span className="font-display text-lg font-semibold text-ink mr-3">
                      Fanzeum
                    </span>
                    <span>
                      The collector&apos;s cabinet for cards, coins, stamps, comics, vinyl &amp; toys.
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    <Link to="/explore" className="hover:text-ink">
                      Explore
                    </Link>
                    <Link to="/add" className="hover:text-ink">
                      Add piece
                    </Link>
                    <Link to="/privacy" className="hover:text-ink">
                      Privacy &amp; UK GDPR
                    </Link>
                  </div>
                </div>
              </footer>

              <MobileTabBar />
              <OfflineIndicator />
              <CookieConsentBar />
            </div>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
