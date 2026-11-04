import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Camera, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { NotificationsButton } from './NotificationsButton';
import {
  FANZEUM_LOGO_ALT,
  FANZEUM_LOGO_SRC,
} from '../lib/brand';
import { Button } from './ui/Button';

export const Header: React.FC = () => {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 text-sm font-medium ${
      isActive
        ? 'text-ink border-brass'
        : 'text-muted border-transparent hover:text-ink'
    }`;

  const showcaseHref = profile?.handle ? `/@${profile.handle}` : '/onboarding';

  const menuLinks: { to: string; label: string; end?: boolean; show?: boolean }[] = [
    { to: '/', label: 'Home', end: true },
    { to: '/fresh-finds', label: 'Fresh Finds' },
    { to: '/explore', label: 'Explore' },
    { to: '/marketplace', label: 'Marketplace' },
    { to: showcaseHref, label: 'My Showcase', show: !!firebaseUser },
    { to: '/communities', label: 'Communities' },
    { to: '/matches', label: 'Matches' },
    { to: '/wantlist', label: 'Wantlist' },
    { to: '/plans', label: 'Plans' },
    { to: '/news', label: 'News & Blog' },
    { to: '/settings', label: 'Settings' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-6 px-4 sm:px-8 h-[80px] md:h-[108px]">
        {/* Zone 1: Wordmark */}
        <Link
          to="/"
          className="shrink-0 inline-flex items-center"
        >
          <img
            src={FANZEUM_LOGO_SRC}
            alt={FANZEUM_LOGO_ALT}
            className="h-[57px] md:h-[71px] w-auto object-contain"
            loading="eager"
          />
        </Link>

        {/* Zone 2: Clean Desktop Navigation */}
        <nav aria-label="Main navigation" className="hidden xl:flex items-center gap-7">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/fresh-finds" className={navLinkClass}>
            Fresh Finds
          </NavLink>
          <NavLink to="/explore" className={navLinkClass}>
            Explore
          </NavLink>
          <NavLink to="/marketplace" className={navLinkClass}>
            Marketplace
          </NavLink>
          {firebaseUser && (
            <NavLink to={showcaseHref} className={navLinkClass}>
              My Showcase
            </NavLink>
          )}
          <NavLink to="/communities" className={navLinkClass}>
            Communities
          </NavLink>
          <NavLink to="/matches" className={navLinkClass}>
            Matches
          </NavLink>
          <NavLink to="/wantlist" className={navLinkClass}>
            Wantlist
          </NavLink>
          <NavLink to="/plans" className={navLinkClass}>
            Plans
          </NavLink>
          <NavLink to="/news" className={navLinkClass}>
            News &amp; Blog
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            Settings
          </NavLink>
        </nav>

        {/* Zone 3: Notifications + Theme Switch + Single Primary Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NotificationsButton />

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to After Hours dark mode'}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-ink hover:border-brass/50 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" strokeWidth={1.5} />
            ) : (
              <Moon className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>

          {firebaseUser ? (
            <Button
              size="sm"
              onClick={() => navigate('/add')}
              className="hidden sm:inline-flex"
            >
              <Camera className="w-4 h-4" strokeWidth={1.5} />
              <span>Add piece</span>
            </Button>
          ) : (
            <Button size="sm" onClick={openAuthModal}>
              Sign in
            </Button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="xl:hidden min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-border bg-surface text-ink hover:border-brass/50 transition-colors cursor-pointer"
          >
            {menuOpen ? <X className="w-5 h-5" strokeWidth={1.5} /> : <Menu className="w-5 h-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <nav
            id="mobile-menu"
            aria-label="Menu"
            className="xl:hidden absolute inset-x-0 top-full z-30 border-b border-border bg-bg shadow-xl max-h-[calc(100vh-80px)] overflow-y-auto"
          >
            <ul className="max-w-[1440px] mx-auto px-4 sm:px-8 py-3 flex flex-col">
              {menuLinks
                .filter((l) => l.show !== false)
                .map((l) => (
                  <li key={l.label}>
                    <NavLink
                      to={l.to}
                      end={l.end}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `block py-3 text-base font-medium border-b border-border/60 ${
                          isActive ? 'text-brass' : 'text-ink hover:text-brass'
                        }`
                      }
                    >
                      {l.label}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </nav>
        </>
      )}
    </header>
  );
};
