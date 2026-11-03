import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function getFriendlyFirebaseErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  // Check if raw is serialized FirestoreErrorInfo
  let innerMsg = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') {
      innerMsg = parsed.error;
    }
  } catch {
    // raw was not JSON
  }

  const lower = innerMsg.toLowerCase();

  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions')) {
    if (!auth.currentUser) {
      return 'Please sign in to save pieces and collections.';
    }
    if (!auth.currentUser.emailVerified) {
      return 'Verify your email to save pieces and collections.';
    }
    return "You don't have permission to perform this action.";
  }

  if (lower.includes('unavailable') || lower.includes('offline') || lower.includes('failed to get document')) {
    return 'Network connection issue. Please check your internet connection and try again.';
  }

  if (lower.includes('not-found')) {
    return 'The requested record could not be found.';
  }

  if (lower.includes('already-exists')) {
    return 'This item or handle already exists.';
  }

  if (lower.includes('unauthenticated')) {
    return 'Please sign in to continue.';
  }

  if (lower.includes('resource-exhausted') || lower.includes('quota')) {
    return 'Daily limit reached. Please try again later.';
  }

  if (lower.includes('auth/unauthorized-domain')) {
    return 'This domain is not yet authorised in Firebase Authentication. Add this domain under Firebase Console → Authentication → Settings → Authorised domains.';
  }

  if (lower.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is turned off in Firebase. Use Continue with Google, or enable Email/Password in Firebase Console → Authentication → Sign-in method.';
  }

  if (lower.includes('auth/invalid-credential') || lower.includes('auth/wrong-password') || lower.includes('auth/user-not-found')) {
    return 'Wrong email or password. Double-check your details and try again.';
  }

  if (lower.includes('auth/email-already-in-use')) {
    return 'That email already has a showcase. Switch to Sign in instead.';
  }

  if (lower.includes('auth/weak-password')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }

  if (lower.includes('auth/requires-recent-login')) {
    return 'For security, sign out and sign right back in before continuing.';
  }

  // Fallback friendly message for any other technical/raw error
  return 'Something went wrong. Please try again.';
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error details:', errInfo);
  throw new Error(getFriendlyFirebaseErrorMessage(errInfo.error));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
