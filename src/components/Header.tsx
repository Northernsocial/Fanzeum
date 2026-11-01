import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { PWAInstallButton } from './PWAInstallButton';

export const Header: React.FC = () => {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b ${
      isActive
        ? 'text-[#1C1917] dark:text-[#F5F2EB] border-[#9A3412] dark:border-[#D97757] font-semibold'
        : 'text-stone-600 dark:text-stone-400 border-transparent hover:text-[#1C1917] dark:hover:text-[#F5F2EB]'
    }`;

  return (
    <div className="border-b border-stone-200 dark:border-stone-800 bg-[#FBF9F5] dark:bg-[#0F0E0D]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="max-w-6xl mx-auto flex items-center justify-between gap-8 px-5 sm:px-8 py-4">
        {/* Zone 1: Single text element wordmark */}
        <Link
          to="/"
          className="text-2xl font-serif font-semibold tracking-tight text-[#1C1917] dark:text-[#F5F2EB] whitespace-nowrap shrink-0"
        >
          Fanzeum
        </Link>

        {/* Zone 2: 5 single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          <NavLink to="/" end className={navLinkClass}>
            Exhibitions
          </NavLink>
          <NavLink to="/curators" className={navLinkClass}>
            Curators
          </NavLink>
          <NavLink to="/onboarding" className={navLinkClass}>
            AI Guide
          </NavLink>
          <NavLink to="/studio" className={navLinkClass}>
            Studio
          </NavLink>
          <NavLink to="/privacy" className={navLinkClass}>
            Privacy
          </NavLink>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {firebaseUser ? (
            <button
              type="button"
              onClick={() => navigate('/studio')}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {profile?.displayName ? `Studio · ${profile.displayName.split(' ')[0]}` : 'Open Studio'}
            </button>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#1C1917] dark:bg-[#F5F2EB] text-[#FBF9F5] dark:text-[#1C1917] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Museum Operational Utility Ribbon (Mobile Nav + Gallery Lighting + PWA Install) */}
      <div className="border-t border-stone-200/70 dark:border-stone-800/80 bg-[#F4EFE6]/60 dark:bg-[#171614]/80">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-2 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex md:hidden items-center gap-5 text-xs font-medium text-stone-600 dark:text-stone-400">
            <NavLink to="/" end className="whitespace-nowrap shrink-0 hover:text-[#1C1917] dark:hover:text-[#F5F2EB]">
              Exhibitions
            </NavLink>
            <NavLink to="/curators" className="whitespace-nowrap shrink-0 hover:text-[#1C1917] dark:hover:text-[#F5F2EB]">
              Curators
            </NavLink>
            <NavLink to="/onboarding" className="whitespace-nowrap shrink-0 hover:text-[#1C1917] dark:hover:text-[#F5F2EB]">
              AI Guide
            </NavLink>
            <NavLink to="/studio" className="whitespace-nowrap shrink-0 hover:text-[#1C1917] dark:hover:text-[#F5F2EB]">
              Studio
            </NavLink>
            <NavLink to="/privacy" className="whitespace-nowrap shrink-0 hover:text-[#1C1917] dark:hover:text-[#F5F2EB]">
              Privacy
            </NavLink>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">
            <span>Public Exhibitions: Open</span>
            <span aria-hidden="true">·</span>
            <span>Valuations in £ GBP</span>
            <span aria-hidden="true">·</span>
            <span>AI Photo Cataloguing Ready</span>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <PWAInstallButton />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to warm daylight gallery' : 'Switch to dark room gallery'}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  Daylight Paper
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  Dark Room
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
