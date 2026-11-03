/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthModal } from './components/AuthModal';
import { CookieConsentBar } from './components/CookieConsentBar';
import { Header } from './components/Header';
import { MobileTabBar } from './components/MobileTabBar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Button } from './components/ui/Button';
import { EmptyState, Skeleton } from './components/ui/EmptyState';
import { HomePage } from './features/home/HomePage';
import {
  FANZEUM_LOGO_ALT,
  FANZEUM_LOGO_SRC,
} from './lib/brand';

const ExplorePage = lazy(() =>
  import('./features/explore/ExplorePage').then((m) => ({ default: m.ExplorePage })),
);
const FreshFindsPage = lazy(() =>
  import('./features/fresh-finds/FreshFindsPage').then((m) => ({ default: m.FreshFindsPage })),
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
const WantlistPage = lazy(() =>
  import('./features/wantlist/WantlistPage').then((m) => ({ default: m.WantlistPage })),
);
const AdminPage = lazy(() =>
  import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })),
);

const LegacyExhibitionRedirect: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  return <Navigate to={collectionId ? `/c/${collectionId}` : '/explore'} replace />;
};

const ShowcaseRoute: React.FC = () => {
  const { profile } = useAuth();
  if (profile?.handle) {
    return <Navigate to={`/@${profile.handle}`} replace />;
  }
  return <CabinetPage />;
};

const LegacyCabinetRedirect: React.FC = () => {
  const { handle } = useParams<{ handle?: string }>();
  if (handle) {
    return <Navigate to={`/showcase/${handle}`} replace />;
  }
  return <Navigate to="/showcase" replace />;
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
    console.error('App caught error:', error);
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error) {
        readable = 'Something went wrong while accessing your showcase. Please check your connection and try again.';
      }
    } catch {
      // Standard error string
    }
    if (readable.includes('Missing or insufficient permissions') || readable.includes('permission-denied')) {
      readable = 'Verify your email to save and view your showcase pieces.';
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
                    <Route path="/fresh-finds" element={<FreshFindsPage />} />
                    <Route path="/explore" element={<ExplorePage />} />
                    <Route path="/category/:categorySlug" element={<ExplorePage />} />
                    <Route path="/c/:collectionId" element={<CollectionPage />} />
                    <Route path="/exhibition/:collectionId" element={<LegacyExhibitionRedirect />} />
                    <Route path="/i/:itemId" element={<ItemPage />} />
                    <Route path="/add" element={<AddPiecePage />} />
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/wantlist" element={<WantlistPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/privacy" element={<SettingsPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/showcase" element={<ShowcaseRoute />} />
                    <Route path="/showcase/:handle" element={<CabinetPage />} />
                    <Route path="/cabinet" element={<LegacyCabinetRedirect />} />
                    <Route path="/cabinet/:handle" element={<LegacyCabinetRedirect />} />
                    <Route path="/u/:handle" element={<CabinetPage />} />
                    <Route path="/:atHandle" element={<CabinetPage />} />
                    <Route
                      path="*"
                      element={
                        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16">
                          <EmptyState
                            title="Page not found"
                            description="That showcase, collection, or piece URL does not exist."
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
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
                    <img
                      src={FANZEUM_LOGO_SRC}
                      alt={FANZEUM_LOGO_ALT}
                      className="h-8 w-auto object-contain"
                      loading="eager"
                    />
                    <span>
                      The collector&apos;s showcase for cards, coins, stamps, comics, vinyl &amp; toys.
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    <Link to="/fresh-finds" className="hover:text-ink">
                      Fresh Finds
                    </Link>
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
