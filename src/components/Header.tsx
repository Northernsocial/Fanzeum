import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bookmark, Camera, Moon, Sun } from 'lucide-react';
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

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 text-sm font-medium ${
      isActive
        ? 'text-ink border-brass'
        : 'text-muted border-transparent hover:text-ink'
    }`;

  const showcaseHref = profile?.handle ? `/@${profile.handle}` : '/onboarding';

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-6 px-4 sm:px-8 h-14 sm:h-16">
        {/* Zone 1: Wordmark */}
        <Link
          to="/"
          className="shrink-0 inline-flex items-center"
        >
          <img
            src={FANZEUM_LOGO_SRC}
            alt={FANZEUM_LOGO_ALT}
            className="h-[43px] md:h-[53px] w-auto object-contain"
            loading="eager"
          />
        </Link>

        {/* Zone 2: Clean Desktop Navigation */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-7">
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
        </div>
      </div>
    </header>
  );
};
