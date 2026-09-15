import { readFile } from 'node:fs/promises';

import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export async function createFirestore(serviceAccountPath: string): Promise<Firestore> {
  if (getApps().length === 0) {
    const serialized = await readFile(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(serialized) as ServiceAccount;
    initializeApp({ credential: cert(serviceAccount) });
  }

  return getFirestore();
}
