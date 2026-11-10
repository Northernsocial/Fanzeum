// Minimal type declarations for firebase-admin to satisfy TypeScript
// This is a server-side only file; firebase-admin is provided by the runtime environment.

declare module 'firebase-admin' {
  export interface App {
    name: string;
    options: any;
  }

  export interface Credential {
    // placeholder
  }

  export const credential: {
    applicationDefault(): Credential;
  };

  export function initializeApp(options: { credential: Credential }): App;

  export const apps: App[];

  export const firestore: {
    (): Firestore;
    FieldValue: {
      serverTimestamp(): any;
      delete(): any;
      arrayUnion(...elements: any[]): any;
      arrayRemove(...elements: any[]): any;
      increment(n: number): any;
    };
  };

  export interface Firestore {
    collection(path: string): CollectionReference;
    doc(path: string): DocumentReference;
  }

  export interface CollectionReference {
    doc(path?: string): DocumentReference;
    add(data: any): Promise<DocumentReference>;
    where(fieldPath: string, opStr: string, value: any): Query;
    get(): Promise<QuerySnapshot>;
  }

  export interface DocumentReference {
    id: string;
    get(): Promise<DocumentSnapshot>;
    set(data: any, options?: { merge?: boolean }): Promise<void>;
    update(data: any): Promise<void>;
    delete(): Promise<void>;
    collection(path: string): CollectionReference;
  }

  export interface DocumentSnapshot {
    exists: boolean;
    id: string;
    data(): any | undefined;
  }

  export interface QuerySnapshot {
    docs: QueryDocumentSnapshot[];
    empty: boolean;
    size: number;
  }

  export interface QueryDocumentSnapshot {
    id: string;
    data(): any;
  }

  export interface Query {
    where(fieldPath: string, opStr: string, value: any): Query;
    get(): Promise<QuerySnapshot>;
    limit(n: number): Query;
    orderBy(fieldPath: string, directionStr?: 'asc' | 'desc'): Query;
  }
}

declare module 'firebase-admin/firestore' {
  export { FieldValue } from 'firebase-admin';
}
