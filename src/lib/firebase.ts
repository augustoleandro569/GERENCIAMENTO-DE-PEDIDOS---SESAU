import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// CRITICAL: Must pass firebaseConfig.firestoreDatabaseId as the third parameter to initializeFirestore
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isOfflineOrUnavailable =
    errMessage.includes('unavailable') ||
    errMessage.includes('the client is offline') ||
    (error as any)?.code === 'unavailable';

  if (isOfflineOrUnavailable) {
    console.warn(`Firestore operating in offline mode for ${operationType} on ${path || 'document'}: ${errMessage}`);
    return;
  }

  const isQuotaExceeded =
    errMessage.includes('Quota limit exceeded') ||
    errMessage.includes('Quota exceeded') ||
    errMessage.includes('quota metric') ||
    (error as any)?.code === 'resource-exhausted';

  if (isQuotaExceeded) {
    console.warn(`[Firestore Quota Notice] Free daily read units quota reached on ${operationType} at ${path || 'database'}: ${errMessage}`);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('gp_firestore_quota_exceeded_day', new Date().toISOString().slice(0, 10));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', {
        detail: {
          error: errMessage,
          operationType,
          path,
          upgradeUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`
        }
      }));
    }
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot as required by system guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (msg.includes('client is offline') || msg.includes('unavailable') || msg.includes('quota') || msg.includes('Quota') || error?.code === 'unavailable') {
      console.warn('Firestore operating in offline / quota limit mode.');
      return false;
    }
    return false;
  }
}

// Run connection test non-blocking after initialization
if (typeof window !== 'undefined') {
  setTimeout(() => {
    testFirestoreConnection().catch(() => {});
  }, 1000);
}
