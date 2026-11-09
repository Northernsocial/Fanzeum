import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
  requireVerified?: boolean;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  requireVerified = true,
}) => {
  const { firebaseUser, isAuthReady, openAuthModal } = useAuth();
  const location = useLocation();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-10 h-10 border-3 border-brass border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!firebaseUser) {
    openAuthModal();
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (requireVerified && !firebaseUser.emailVerified) {
    openAuthModal();
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
