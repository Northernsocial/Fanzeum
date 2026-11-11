declare module 'firebase-admin/app' {
  export interface App {
    name: string;
    options: Record<string, unknown>;
  }

  export interface ServiceAccount {
    type?: string;
    projectId?: string;
    privateKey?: string;
    clientEmail?: string;
    private_key?: string;
    client_email?: string;
    project_id?: string;
  }

  export type Credential = unknown;

  export function initializeApp(options?: {
    credential?: Credential;
    projectId?: string;
  }): App;

  export function cert(serviceAccount: ServiceAccount | string): Credential;

  export function getApps(): App[];
}

declare module 'firebase-admin/auth' {
  export interface DecodedIdToken {
    uid: string;
    aud: string;
    [key: string]: unknown;
  }

  export interface Auth {
    verifyIdToken(idToken: string, checkRevoked?: boolean): Promise<DecodedIdToken>;
  }

  export function getAuth(app?: unknown): Auth;
}

declare module 'firebase-admin/firestore' {
  export interface Firestore {
    collection(collectionPath: string): CollectionReference;
    doc(documentPath: string): DocumentReference;
  }

  export interface CollectionReference {
    doc(documentPath?: string): DocumentReference;
  }

  export interface DocumentReference {
    get(): Promise<DocumentSnapshot>;
    set(data: unknown): Promise<void>;
    update(data: unknown): Promise<void>;
    delete(): Promise<void>;
  }

  export interface DocumentSnapshot {
    exists: boolean;
    data(): Record<string, unknown> | undefined;
    id: string;
  }

  export function getFirestore(app?: unknown): Firestore;
}
