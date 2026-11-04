import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Camera, Compass, Home, LayoutGrid, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const MobileTabBar: React.FC = () => {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const showcasePath = profile?.handle ? `/@${profile.handle}` : '/onboarding';
  const isShowcaseActive =
    Boolean(profile?.handle) &&
    (location.pathname === `/@${profile?.handle}` ||
      location.pathname === `/u/${profile?.handle}` ||
      location.pathname === `/showcase/${profile?.handle}`);

  const itemClass = (active: boolean) =>
    `flex flex-col items-center justify-center min-h-[48px] min-w-[56px] px-1 text-[11px] font-medium transition-colors cursor-pointer ${
      active ? 'text-brass' : 'text-muted hover:text-ink'
    }`;

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md pb-safe"
    >
      <div className="grid grid-cols-5 items-center max-w-md mx-auto px-2 pt-1">
        <NavLink to="/" end className={({ isActive }) => itemClass(isActive)}>
          <Home className="w-5 h-5 mb-0.5" strokeWidth={1.5} />
          <span>Home</span>
        </NavLink>

        <NavLink to="/explore" className={({ isActive }) => itemClass(isActive)}>
          <Compass className="w-5 h-5 mb-0.5" strokeWidth={1.5} />
          <span>Explore</span>
        </NavLink>

        <NavLink to="/marketplace" className={({ isActive }) => itemClass(isActive)}>
          <Home className="w-5 h-5 mb-0.5" strokeWidth={1.5} />
          <span>Market</span>
        </NavLink>

        {/* Centre Raised Brass Add Piece Action */}
        <div className="flex flex-col items-center justify-center -mt-4">
          <button
            type="button"
            onClick={() => {
              if (!firebaseUser) {
                openAuthModal();
              } else {
                navigate('/add');
              }
            }}
            aria-label="Add a piece by photo"
            className="w-12 h-12 rounded-2xl bg-brass text-brass-fg shadow-lg flex items-center justify-center hover:opacity-95 transition-opacity cursor-pointer"
          >
            <Camera className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <span className="text-[11px] font-medium text-ink mt-0.5">Add</span>
        </div>

        <NavLink to="/wantlist" className={({ isActive }) => itemClass(isActive)}>
          <Bookmark className="w-5 h-5 mb-0.5" strokeWidth={1.5} />
          <span>Wants</span>
        </NavLink>

        <button
          type="button"
          onClick={() => {
            if (!firebaseUser) {
              openAuthModal();
            } else {
              navigate(showcasePath);
            }
          }}
          className={itemClass(isShowcaseActive)}
        >
          <LayoutGrid className="w-5 h-5 mb-0.5" strokeWidth={1.5} />
          <span>Showcase</span>
        </button>
      </div>
    </nav>
  );
};
