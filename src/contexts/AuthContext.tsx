import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import {
  bootstrapVerifiedUserProfile,
  eraseAllUserFirestoreData,
  fetchUserPrivateAccount,
  fetchUserProfile,
  migrateLegacyBase64Images,
} from '../lib/firestoreRepo';
import type { UserPrivateAccount, UserProfile } from '../types/domain';

const ADMIN_EMAIL = 'fifestreet@gmail.com';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  privateAccount: UserPrivateAccount | null;
  isAdminUser: boolean;
  isAuthReady: boolean;
  needsEmailVerification: boolean;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (displayName: string, email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccountAndData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateAccount, setPrivateAccount] = useState<UserPrivateAccount | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const syncUserRecords = useCallback(async (user: User) => {
    if (!user.emailVerified) {
      setProfile(null);
      setPrivateAccount(null);
      return;
    }

    const existingProfile = await fetchUserProfile(user.uid);
    if (existingProfile) {
      setProfile(existingProfile);
      const priv = await fetchUserPrivateAccount(user.uid);
      setPrivateAccount(priv);
      void migrateLegacyBase64Images(user.uid);
    } else {
      const savedCookie = window.localStorage.getItem('fanzeum_cookie_consent');
      const analyticsConsent = savedCookie === 'all';
      const created = await bootstrapVerifiedUserProfile({
        uid: user.uid,
        email: user.email || 'collector@example.co.uk',
        displayName: user.displayName || user.email?.split('@')[0] || 'Collector',
        avatarUrl: user.photoURL || '',
        analyticsConsent,
      });
      setProfile(created.profile);
      setPrivateAccount(created.privateAccount);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await syncUserRecords(user);
        } catch (err) {
          console.error('Error syncing collector profile:', err);
        }
      } else {
        setProfile(null);
        setPrivateAccount(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [syncUserRecords]);

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await syncUserRecords(cred.user);
    setAuthModalOpen(false);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await syncUserRecords(cred.user);
    setAuthModalOpen(false);
  };

  const registerWithEmail = async (displayName: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 80) });
    }
    await sendEmailVerification(cred.user);
    setFirebaseUser(cred.user);
    setAuthModalOpen(false);
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const updatedUser = auth.currentUser;
    setFirebaseUser({ ...updatedUser } as User);
    if (updatedUser.emailVerified) {
      await syncUserRecords(updatedUser);
      return true;
    }
    return false;
  };

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser || !auth.currentUser.emailVerified) return;
    const [p, priv] = await Promise.all([
      fetchUserProfile(auth.currentUser.uid),
      fetchUserPrivateAccount(auth.currentUser.uid),
    ]);
    setProfile(p);
    setPrivateAccount(priv);
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
    setPrivateAccount(null);
  };

  const deleteAccountAndData = async () => {
    const current = auth.currentUser;
    if (!current) return;
    if (current.emailVerified) {
      await eraseAllUserFirestoreData(current.uid);
    }
    await deleteUser(current);
    setProfile(null);
    setPrivateAccount(null);
  };

  const needsEmailVerification = Boolean(firebaseUser && !firebaseUser.emailVerified);
  const isAdminUser = Boolean(
    firebaseUser?.emailVerified &&
      (firebaseUser.email?.toLowerCase() === ADMIN_EMAIL || profile?.role === 'admin'),
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        privateAccount,
        isAdminUser,
        isAuthReady,
        needsEmailVerification,
        authModalOpen,
        openAuthModal: () => setAuthModalOpen(true),
        closeAuthModal: () => setAuthModalOpen(false),
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resendVerificationEmail,
        refreshVerificationStatus,
        refreshProfile,
        signOut,
        deleteAccountAndData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
